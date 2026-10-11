// POST { introId: string, action: 'generate' | 'approve' }
//
// The headline paid feature, built consent-first:
//   * 'generate' is called by the SUBJECT on their own brief, after they linked what they
//     want seen and switched brief_consent on. The agent reads only those links plus the
//     vouches. Nothing is searched for. The subject sees it first.
//   * 'approve' is called by the subject to release the brief to the other person.
//   * Reading is a plain select; RLS releases it to the other side only once approved,
//     and the app shows it only to Mash Plus members.
//
// What this never does: look anyone up before they joined, or pull anything they did
// not link. See the business plan's legal section for why.

import { admin, handler, json, readBody, requireUser, HttpError, ageFrom } from '../_shared/supabase.ts';
import { writeBrief } from '../_shared/matchmaker.ts';
import { notify } from '../_shared/push.ts';

interface Body {
  introId: string;
  action: 'generate' | 'approve';
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_FETCH_CHARS = 6000;

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!body.introId) throw new HttpError(400, 'introId required');

    const { data: intro } = await admin
      .from('introductions')
      .select('id, single_id, candidate_id, voucher_ids, status')
      .eq('id', body.introId)
      .single();
    if (!intro) throw new HttpError(404, 'Not found');
    if (intro.single_id !== userId && intro.candidate_id !== userId) throw new HttpError(403, 'Not your introduction');

    if (body.action === 'approve') {
      const { error } = await admin
        .from('briefs')
        .update({ subject_approved: true })
        .eq('intro_id', body.introId)
        .eq('subject_id', userId);
      if (error) throw error;
      const other = intro.single_id === userId ? intro.candidate_id : intro.single_id;
      const { data: me } = await admin.from('profiles').select('first_name').eq('id', userId).single();
      await notify(other, 'system', `${me?.first_name ?? 'They'} shared their brief with you.`, { route: `/intro/${body.introId}` });
      return json({ ok: true });
    }

    // generate
    const { data: subject } = await admin
      .from('profiles')
      .select('id, first_name, date_of_birth, city, bio, verified_photo, verified_social, brief_consent')
      .eq('id', userId)
      .single();
    if (!subject) throw new HttpError(404, 'Profile not found');
    if (!subject.brief_consent) throw new HttpError(409, 'Turn on "share a brief about me" in settings first');

    const { data: linked } = await admin.from('linked_profiles').select('kind, url').eq('user_id', userId);
    const { data: vouches } = await admin
      .from('vouches')
      .select('text, profiles:voucher_id(first_name)')
      .eq('single_id', userId);

    const fetched = await Promise.all(
      (linked ?? []).map(async (l: { kind: string; url: string }) => ({
        kind: l.kind,
        url: l.url,
        fetched_text: await fetchPublicText(l.url),
      })),
    );

    const content = await writeBrief({
      subject: {
        first_name: subject.first_name,
        age: ageFrom(subject.date_of_birth),
        city: subject.city,
        bio: subject.bio,
        verified_photo: subject.verified_photo,
        verified_social: subject.verified_social,
      },
      vouches: (vouches ?? []).map((v: { text: string; profiles: unknown }) => {
        const p = v.profiles as { first_name: string } | { first_name: string }[] | null;
        return { voucher_first_name: (Array.isArray(p) ? p[0]?.first_name : p?.first_name) ?? 'A friend', text: v.text };
      }),
      linked: fetched,
    });

    const stored = {
      ...content,
      vouched_by: (vouches ?? []).map((v: { text: string; profiles: unknown }) => {
        const p = v.profiles as { first_name: string } | { first_name: string }[] | null;
        return { first_name: (Array.isArray(p) ? p[0]?.first_name : p?.first_name) ?? 'A friend', text: v.text };
      }),
    };

    const { data: brief, error } = await admin
      .from('briefs')
      .upsert(
        { intro_id: body.introId, subject_id: userId, content: stored, subject_approved: false, generated_at: new Date().toISOString() },
        { onConflict: 'intro_id,subject_id' },
      )
      .select('id, content, subject_approved')
      .single();
    if (error) throw error;
    return json({ brief });
  }),
);

/**
 * Fetch the visible text of a page the subject linked. Meta properties (Instagram, Facebook)
 * block scraping and their terms forbid it, so for those we only confirm the handle exists
 * in the URL and fetch nothing. Everything else is read once, trimmed, and passed to the agent.
 */
async function fetchPublicText(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (host.endsWith('instagram.com') || host.endsWith('facebook.com') || host.endsWith('threads.net')) {
    return null;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'MashBrief/1.0 (+https://mash.dating)' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return text.slice(0, MAX_FETCH_CHARS) || null;
  } catch {
    return null;
  }
}
