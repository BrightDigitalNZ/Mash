// POST { hashes: string[], myPhoneHash?: string }
// Stores the caller's contact hashes, finds who in their contacts is already on Mash
// (both directions: people I have, and people who have me), creates connections,
// and resolves any pending nominations addressed to the caller's own phone hash.
//
// Returns { matched: PublicProfile[], pendingInvites: {voucher_first_name, invite_message}[] }

import { admin, handler, json, readBody, requireUser, HttpError, ageFrom } from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';

interface Body {
  hashes: string[];
  myPhoneHash?: string;
}

const MAX_HASHES = 5000;

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);

    if (!Array.isArray(body.hashes)) throw new HttpError(400, 'hashes must be an array');
    const hashes = Array.from(new Set(body.hashes.filter((h) => typeof h === 'string' && /^[a-f0-9]{64}$/.test(h)))).slice(
      0,
      MAX_HASHES,
    );

    // 1. Save my own phone hash so friends can find me.
    if (body.myPhoneHash && /^[a-f0-9]{64}$/.test(body.myPhoneHash)) {
      await admin.from('profiles').update({ phone_hash: body.myPhoneHash }).eq('id', userId);
    }

    // 2. Replace my contact hashes.
    await admin.from('contact_hashes').delete().eq('owner_id', userId);
    if (hashes.length > 0) {
      const rows = hashes.map((hash) => ({ owner_id: userId, hash }));
      for (let i = 0; i < rows.length; i += 1000) {
        const { error } = await admin.from('contact_hashes').insert(rows.slice(i, i + 1000));
        if (error) throw error;
      }
    }

    // 3. People in my contacts who are on Mash.
    const { data: iHave } = hashes.length
      ? await admin.from('profiles').select('id').in('phone_hash', hashes).neq('id', userId)
      : { data: [] as { id: string }[] };

    // 4. People who have me in their contacts.
    const { data: me } = await admin.from('profiles').select('phone_hash').eq('id', userId).single();
    const { data: haveMe } = me?.phone_hash
      ? await admin.from('contact_hashes').select('owner_id').eq('hash', me.phone_hash).neq('owner_id', userId)
      : { data: [] as { owner_id: string }[] };

    const others = new Set<string>([
      ...(iHave ?? []).map((p: { id: string }) => p.id),
      ...(haveMe ?? []).map((c: { owner_id: string }) => c.owner_id),
    ]);

    // 5. Upsert connections (normalised a < b).
    if (others.size > 0) {
      const rows = Array.from(others).map((other) => ({
        user_a: userId < other ? userId : other,
        user_b: userId < other ? other : userId,
        source: 'contacts',
      }));
      const { error } = await admin.from('connections').upsert(rows, { onConflict: 'user_a,user_b', ignoreDuplicates: true });
      if (error) throw error;
    }

    // 6. Pending nominations addressed to me: resolve them and tell the voucher.
    const pendingInvites: { voucher_first_name: string; invite_message: string | null }[] = [];
    if (me?.phone_hash) {
      const { data: noms } = await admin
        .from('nominations')
        .select('id, voucher_id, invite_message, profiles:voucher_id(first_name)')
        .eq('nominee_hash', me.phone_hash)
        .eq('status', 'pending');
      for (const n of noms ?? []) {
        await admin
          .from('nominations')
          .update({ nominee_user_id: userId, status: 'accepted', accepted_at: new Date().toISOString() })
          .eq('id', n.id);
        await admin.from('connections').upsert(
          {
            user_a: userId < n.voucher_id ? userId : n.voucher_id,
            user_b: userId < n.voucher_id ? n.voucher_id : userId,
            source: 'invite',
          },
          { onConflict: 'user_a,user_b', ignoreDuplicates: true },
        );
        const voucherName = (n.profiles as unknown as { first_name: string } | null)?.first_name ?? 'A friend';
        pendingInvites.push({ voucher_first_name: voucherName, invite_message: n.invite_message });
        const { data: meProfile } = await admin.from('profiles').select('first_name').eq('id', userId).single();
        await notify(n.voucher_id, 'invite_accepted', `${meProfile?.first_name ?? 'Your friend'} joined Mash from your invite.`, {
          route: '/(voucher)/friends',
        });
      }
    }

    // 7. Return the matched people as public cards.
    const { data: matched } = others.size
      ? await admin
          .from('profiles')
          .select('id, first_name, photo_url, city, bio, verified_photo, verified_social, date_of_birth, role')
          .in('id', Array.from(others))
      : { data: [] };

    return json({
      matched: (matched ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        first_name: p.first_name,
        photo_url: p.photo_url,
        city: p.city,
        bio: p.bio,
        verified_photo: p.verified_photo,
        verified_social: p.verified_social,
        role: p.role,
        age: ageFrom(p.date_of_birth as string | null),
      })),
      pendingInvites,
    });
  }),
);
