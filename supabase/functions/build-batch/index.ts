// POST { catchId: string, candidateIds: string[] }
// Called by a Mashmaker. The Machine's matching assist filters their nominations against
// what the Catch wants and writes the reason for each. Then every kept nominee is ASKED
// before the Catch sees them (consent at every step). The batch sits in "consenting" until
// at least one nominee says yes, when the Catch is told a batch has arrived.
//
// Quality not quantity: nominations capped at app_settings.batch_max (three to five), one
// open batch per Catch at a time. The trial clock starts here when trial_gate = first_batch.
//
// Returns { batchId, kept, dropped: {candidate_id, first_name, reason}[], note }

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
import { notify } from '../_shared/push.ts';
import { assistBatch, type MachineCandidate, type MachineCatch } from '../_shared/machine.ts';

interface Body {
  catchId: string;
  candidateIds: string[];
}

Deno.serve(
  handler(async (req) => {
    const mashmakerId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!body.catchId || !Array.isArray(body.candidateIds))
      throw new HttpError(400, 'catchId and candidateIds required');

    const batchMax = Number(await setting('batch_max', '5'));
    const candidateIds = Array.from(new Set(body.candidateIds)).filter(
      (id) => id !== body.catchId && id !== mashmakerId,
    );
    if (candidateIds.length === 0) throw new HttpError(400, 'Nominate at least one person');
    if (candidateIds.length > batchMax)
      throw new HttpError(400, `A batch is at most ${batchMax} people. Fewer, better.`);

    // Only an accepted Mashmaker, with a vouch written, may nominate.
    const { data: link } = await admin
      .from('mashmaker_links')
      .select('id')
      .eq('mashmaker_id', mashmakerId)
      .eq('catch_id', body.catchId)
      .eq('status', 'accepted')
      .maybeSingle();
    if (!link) throw new HttpError(403, 'They have not accepted you as their Mashmaker yet');
    const { data: vouch } = await admin
      .from('vouches')
      .select('id')
      .eq('mashmaker_id', mashmakerId)
      .eq('catch_id', body.catchId)
      .maybeSingle();
    if (!vouch)
      throw new HttpError(
        409,
        'Write your line about them first. It is the first thing a Catch reads.',
      );

    // One batch open at a time.
    const { data: open } = await admin
      .from('batches')
      .select('id')
      .eq('catch_id', body.catchId)
      .in('status', ['building', 'consenting', 'ready'])
      .limit(1);
    if (open && open.length)
      throw new HttpError(
        409,
        'They have a batch open already. The next one comes after that resolves.',
      );

    const { data: c } = await admin
      .from('profiles')
      .select(
        'id, first_name, date_of_birth, city, bio, paused, role, open_to_matching, trial_started_at',
      )
      .eq('id', body.catchId)
      .single();
    if (!c || c.role !== 'catch') throw new HttpError(404, 'Catch not found');
    if (!c.open_to_matching)
      throw new HttpError(409, `${c.first_name} has not switched on matching yet`);
    if (c.paused) throw new HttpError(409, `${c.first_name} has paused Mash for now`);

    // The eligible list is the same one the app shows: compatible, consented to matching, not
    // excluded, not already mashed. Anything outside it is silently ignored.
    const { data: eligible } = await admin
      .rpc('nominatable_for', { catch: body.catchId })
      .select('candidate_id');
    void eligible; // nominatable_for uses auth.uid(); re-check by hand under the service role below

    const { data: catchCriteria } = await admin
      .from('criteria')
      .select('*')
      .eq('catch_id', body.catchId)
      .maybeSingle();
    const { data: catchVouches } = await admin
      .from('vouches')
      .select('prompt, text, profiles:mashmaker_id(first_name)')
      .eq('catch_id', body.catchId);
    const { data: catchProfile } = await admin
      .from('profiles')
      .select('gender, seeking')
      .eq('id', body.catchId)
      .single();

    const { data: candRows } = await admin
      .from('profiles')
      .select(
        'id, first_name, date_of_birth, city, bio, paused, role, onboarding_complete, open_to_matching, gender, seeking',
      )
      .in('id', candidateIds);

    const valid: NonNullable<typeof candRows> = [];
    for (const p of candRows ?? []) {
      if (p.role !== 'catch' || p.paused || !p.onboarding_complete || !p.open_to_matching) continue;
      const a = mashmakerId < p.id ? mashmakerId : p.id;
      const b = mashmakerId < p.id ? p.id : mashmakerId;
      const { data: conn } = await admin
        .from('connections')
        .select('user_a')
        .eq('user_a', a)
        .eq('user_b', b)
        .maybeSingle();
      if (!conn) continue;
      const { data: blocked } = await admin
        .from('blocks')
        .select('blocker_id')
        .or(
          `and(blocker_id.eq.${p.id},blocked_id.eq.${body.catchId}),and(blocker_id.eq.${body.catchId},blocked_id.eq.${p.id})`,
        )
        .limit(1);
      if (blocked && blocked.length) continue;
      const { data: excluded } = await admin.rpc('is_excluded_either_way', {
        a: body.catchId,
        b: p.id,
      });
      if (excluded) continue;
      const cg = catchProfile?.gender as string | null;
      const cs = (catchProfile?.seeking as string[]) ?? [];
      if (cg && (p.seeking as string[]).length && !(p.seeking as string[]).includes(cg)) continue;
      if (p.gender && cs.length && !cs.includes(p.gender as string)) continue;
      const { data: mash } = await admin
        .from('mashes')
        .select('id')
        .or(
          `and(catch_id.eq.${body.catchId},candidate_id.eq.${p.id}),and(catch_id.eq.${p.id},candidate_id.eq.${body.catchId})`,
        )
        .limit(1);
      if (mash && mash.length) continue;
      valid.push(p);
    }
    if (valid.length === 0)
      throw new HttpError(400, 'None of those people can be in a batch right now');

    const candidates: MachineCandidate[] = [];
    for (const p of valid) {
      const { data: crit } = await admin
        .from('criteria')
        .select('*')
        .eq('catch_id', p.id)
        .maybeSingle();
      const { data: vs } = await admin
        .from('vouches')
        .select('prompt, text, profiles:mashmaker_id(first_name)')
        .eq('catch_id', p.id);
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { count: passes } = await admin
        .from('batch_entries')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', p.id)
        .eq('decision', 'pass')
        .gte('decided_at', since);
      candidates.push({
        id: p.id,
        first_name: p.first_name,
        age: ageFrom(p.date_of_birth),
        city: p.city,
        bio: p.bio,
        criteria: crit ? pickCriteria(crit) : null,
        vouches: (vs ?? []).map(mapVouch),
        prior_passes: passes ?? 0,
      });
    }

    const { data: mashmaker } = await admin
      .from('profiles')
      .select('first_name')
      .eq('id', mashmakerId)
      .single();
    const catchInput: MachineCatch = {
      first_name: c.first_name,
      age: ageFrom(c.date_of_birth),
      city: c.city,
      bio: c.bio,
      criteria: catchCriteria ? pickCriteria(catchCriteria) : null,
      vouches: (catchVouches ?? []).map(mapVouch),
    };

    const { data: batch, error: batchErr } = await admin
      .from('batches')
      .insert({ mashmaker_id: mashmakerId, catch_id: body.catchId, status: 'building' })
      .select('id')
      .single();
    if (batchErr || !batch) throw batchErr ?? new Error('Could not create batch');

    let result;
    try {
      result = await assistBatch({
        mashmakerFirstName: mashmaker?.first_name ?? 'Your friend',
        catch: catchInput,
        candidates,
        maxKept: batchMax,
      });
    } catch (err) {
      await admin.from('batches').delete().eq('id', batch.id);
      throw err;
    }

    const entries = [
      ...result.kept.map((k) => ({
        batch_id: batch.id,
        candidate_id: k.candidate_id,
        kept: true,
        position: k.position,
        reason: k.reason,
        consent: 'pending',
      })),
      ...result.dropped.map((d) => ({
        batch_id: batch.id,
        candidate_id: d.candidate_id,
        kept: false,
        position: null,
        dropped_reason: d.reason,
        consent: 'no',
      })),
    ];
    const { error: entErr } = await admin.from('batch_entries').insert(entries);
    if (entErr) throw entErr;

    const status = result.kept.length > 0 ? 'consenting' : 'done';
    await admin
      .from('batches')
      .update({
        status,
        machine_note: result.note_to_mashmaker,
        done_at: status === 'done' ? new Date().toISOString() : null,
      })
      .eq('id', batch.id);

    // Ask each nominee before the Catch sees them.
    for (const k of result.kept) {
      await notify(
        k.candidate_id,
        'consent_request',
        `${mashmaker?.first_name ?? 'A friend'} would like to show you to ${c.first_name}. Okay?`,
        {
          route: `/consent/${batch.id}`,
        },
      );
    }

    // Trial clock, when the gate is first_batch.
    if ((await setting('trial_gate', 'first_batch')) === 'first_batch' && !c.trial_started_at) {
      const days = Number(await setting('trial_days', '21'));
      const now = new Date();
      await admin
        .from('profiles')
        .update({
          trial_started_at: now.toISOString(),
          trial_ends_at: new Date(now.getTime() + days * 86400000).toISOString(),
        })
        .eq('id', body.catchId);
    }

    const nameOf = (id: string) => candidates.find((x) => x.id === id)?.first_name ?? 'Someone';
    return json({
      batchId: batch.id,
      kept: result.kept.length,
      dropped: result.dropped.map((d) => ({ ...d, first_name: nameOf(d.candidate_id) })),
      note: result.note_to_mashmaker,
    });
  }),
);

function pickCriteria(c: Record<string, unknown>) {
  return {
    age_min: Number(c.age_min),
    age_max: Number(c.age_max),
    radius_km: Number(c.radius_km),
    dealbreakers: (c.dealbreakers as string[]) ?? [],
    intent: String(c.intent),
    open_text: (c.open_text as string | null) ?? null,
  };
}

function mapVouch(v: { prompt: string; text: string; profiles: unknown }) {
  const p = v.profiles as { first_name: string } | { first_name: string }[] | null;
  const name = Array.isArray(p) ? p[0]?.first_name : p?.first_name;
  return { mashmaker_first_name: name ?? 'A friend', prompt: v.prompt, text: v.text };
}
