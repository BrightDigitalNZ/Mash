// POST { hashes: string[], myPhoneHash?: string }
// Stores the caller's contact hashes, finds who in their contacts is already on Mash
// (both directions), creates connections, and resolves pending invites addressed to the
// caller's own phone hash. Re-sync is explicit: the app calls this only when the user asks.
//
// Non-users stay invisible: nothing is created for a hash that matches nobody.
// Returns { matched: PublicProfile[], pendingInvites: {inviter_first_name, message}[] }

import {
  admin,
  handler,
  json,
  readBody,
  requireUser,
  HttpError,
  ageFrom,
} from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';
import { orderedPair } from '../_shared/rules.ts';

interface Body {
  hashes: string[];
  myPhoneHash?: string;
}

const MAX_HASHES = 5000;
const HEX64 = /^[a-f0-9]{64}$/;

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!Array.isArray(body.hashes)) throw new HttpError(400, 'hashes must be an array');
    const hashes = Array.from(
      new Set(body.hashes.filter((h) => typeof h === 'string' && HEX64.test(h))),
    ).slice(0, MAX_HASHES);

    if (body.myPhoneHash && HEX64.test(body.myPhoneHash)) {
      await admin.from('profiles').update({ phone_hash: body.myPhoneHash }).eq('id', userId);
    }

    await admin.from('contact_hashes').delete().eq('owner_id', userId);
    for (let i = 0; i < hashes.length; i += 1000) {
      const { error } = await admin
        .from('contact_hashes')
        .insert(hashes.slice(i, i + 1000).map((hash) => ({ owner_id: userId, hash })));
      if (error) throw error;
    }

    const { data: iHave } = hashes.length
      ? await admin.from('profiles').select('id').in('phone_hash', hashes).neq('id', userId)
      : { data: [] as { id: string }[] };
    const { data: me } = await admin
      .from('profiles')
      .select('phone_hash, first_name, role')
      .eq('id', userId)
      .single();
    const { data: haveMe } = me?.phone_hash
      ? await admin
          .from('contact_hashes')
          .select('owner_id')
          .eq('hash', me.phone_hash)
          .neq('owner_id', userId)
      : { data: [] as { owner_id: string }[] };

    const others = new Set<string>([
      ...(iHave ?? []).map((p: { id: string }) => p.id),
      ...(haveMe ?? []).map((c: { owner_id: string }) => c.owner_id),
    ]);

    if (others.size > 0) {
      const rows = Array.from(others).map((other) => ({
        ...orderedPair(userId, other),
        source: 'contacts',
      }));
      const { error } = await admin
        .from('connections')
        .upsert(rows, { onConflict: 'user_a,user_b', ignoreDuplicates: true });
      if (error) throw error;
    }

    const pendingInvites: { inviter_first_name: string; message: string | null }[] = [];
    if (me?.phone_hash) {
      const { data: invites } = await admin
        .from('invites')
        .select('id, inviter_id, message, profiles:inviter_id(first_name, role)')
        .eq('invitee_hash', me.phone_hash)
        .eq('status', 'pending');
      for (const inv of invites ?? []) {
        await admin
          .from('invites')
          .update({
            invitee_user_id: userId,
            status: 'accepted',
            accepted_at: new Date().toISOString(),
          })
          .eq('id', inv.id);
        await admin
          .from('connections')
          .upsert(
            { ...orderedPair(userId, inv.inviter_id), source: 'invite' },
            { onConflict: 'user_a,user_b', ignoreDuplicates: true },
          );
        const inviter = inv.profiles as unknown as {
          first_name: string;
          role: string | null;
        } | null;
        pendingInvites.push({
          inviter_first_name: inviter?.first_name ?? 'A friend',
          message: inv.message,
        });
        await notify(
          inv.inviter_id,
          'invite_accepted',
          `${me.first_name || 'Your friend'} joined Mash from your invite.`,
          {
            route: inviter?.role === 'catch' ? '/(catch)/mashmakers' : '/(mashmaker)/catches',
          },
        );
      }
    }

    const { data: matched } = others.size
      ? await admin
          .from('profiles')
          .select(
            'id, first_name, photo_url, city, bio, verified_identity, photos_current, date_of_birth, role, phone_hash',
          )
          .in('id', Array.from(others))
      : { data: [] };

    return json({
      matched: (matched ?? []).map((p: Record<string, unknown>) => ({
        id: p.id,
        first_name: p.first_name,
        photo_url: p.photo_url,
        city: p.city,
        bio: p.bio,
        verified_identity: p.verified_identity,
        photos_current: p.photos_current,
        role: p.role,
        age: ageFrom(p.date_of_birth as string | null),
        hash: hashes.includes(p.phone_hash as string) ? (p.phone_hash as string) : null,
      })),
      pendingInvites,
    });
  }),
);
