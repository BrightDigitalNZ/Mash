// POST { mashId: string }
// The Machine's due diligence, requested by one Catch about the other Catch in a mash.
//
// Boundaries (Brief section 8):
//   * identity and consistency only, public sources only, nothing behind a login, no brokers
//   * shown only to the requester; never to the Mashmaker, never to the subject
//   * the subject's consent ("let the Machine run checks on me") is specific and visible
//     in their settings; without it there is no brief
//   * not stored beyond the open mash (purged by trigger when it closes)
//   * paid or part of the free safety promise is OPEN: app_settings.dd_requires_plus

import {
  admin,
  handler,
  json,
  readBody,
  requireUser,
  HttpError,
  ageFrom,
  setting,
} from '../_shared/supabase.ts';
import { dueDiligence } from '../_shared/machine.ts';

interface Body {
  mashId: string;
}

const FETCH_TIMEOUT_MS = 6000;
const MAX_FETCH_CHARS = 6000;

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!body.mashId) throw new HttpError(400, 'mashId required');

    const { data: mash } = await admin
      .from('mashes')
      .select('id, catch_id, candidate_id, status')
      .eq('id', body.mashId)
      .single();
    if (!mash) throw new HttpError(404, 'Not found');
    if (mash.catch_id !== userId && mash.candidate_id !== userId)
      throw new HttpError(403, 'Not your mash');
    if (!['pending', 'mutual', 'met'].includes(mash.status))
      throw new HttpError(409, 'This mash is closed');

    if ((await setting('dd_requires_plus', 'true')) === 'true') {
      const { data: entitled } = await admin.rpc('is_entitled', { who: userId });
      if (!entitled) throw new HttpError(402, 'The Machine’s checks are part of Mash Plus');
    }

    const subjectId = mash.catch_id === userId ? mash.candidate_id : mash.catch_id;
    const { data: subject } = await admin
      .from('profiles')
      .select(
        'id, first_name, date_of_birth, city, bio, verified_identity, photos_current, dd_consent',
      )
      .eq('id', subjectId)
      .single();
    if (!subject) throw new HttpError(404, 'Profile not found');
    if (!subject.dd_consent)
      throw new HttpError(
        409,
        `${subject.first_name} has not switched on checks. You can still ask them anything you like.`,
      );

    const { data: existing } = await admin
      .from('briefs')
      .select('id, content, generated_at')
      .eq('mash_id', body.mashId)
      .eq('requester_id', userId)
      .maybeSingle();
    if (existing) return json({ brief: existing });

    const { data: linked } = await admin
      .from('linked_profiles')
      .select('kind, url')
      .eq('user_id', subjectId);
    const fetched = await Promise.all(
      (linked ?? []).map(async (l: { kind: string; url: string }) => ({
        kind: l.kind,
        url: l.url,
        fetched_text: await fetchPublicText(l.url),
      })),
    );

    const content = await dueDiligence({
      subject: {
        first_name: subject.first_name,
        age: ageFrom(subject.date_of_birth),
        city: subject.city,
        bio: subject.bio,
        verified_identity: subject.verified_identity,
        photos_current: subject.photos_current,
      },
      linked: fetched,
    });

    const { data: brief, error } = await admin
      .from('briefs')
      .insert({ mash_id: body.mashId, requester_id: userId, subject_id: subjectId, content })
      .select('id, content, generated_at')
      .single();
    if (error) throw error;
    return json({ brief });
  }),
);

/** Public pages only. Nothing behind a login; Meta properties are never fetched. */
async function fetchPublicText(url: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (
    host.endsWith('instagram.com') ||
    host.endsWith('facebook.com') ||
    host.endsWith('threads.net')
  )
    return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: { 'User-Agent': 'MashMachine/1.0' },
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
