// POST { singleId: string, candidateIds: string[] }
// Called by a voucher. The agent filters their nominations against the single's
// criteria and vouches, writes the lineup, and tells the single straight away.
//
// Returns { lineupId, kept: number, dropped: {candidate_id, reason}[], note }

import { admin, handler, json, readBody, requireUser, HttpError, ageFrom } from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';
import { buildLineup, type LineupCandidate, type LineupSingle } from '../_shared/matchmaker.ts';

interface Body {
  singleId: string;
  candidateIds: string[];
}

const MAX_NOMINATED = 10;
const MAX_KEPT = 7;
const CIRCLE_UNLOCK = Number(Deno.env.get('CIRCLE_UNLOCK') ?? '10');

Deno.serve(
  handler(async (req) => {
    const voucherId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!body.singleId || !Array.isArray(body.candidateIds)) throw new HttpError(400, 'singleId and candidateIds required');

    const candidateIds = Array.from(new Set(body.candidateIds)).filter((id) => id !== body.singleId && id !== voucherId).slice(0, MAX_NOMINATED);
    if (candidateIds.length === 0) throw new HttpError(400, 'Nominate at least one person');

    // The voucher must vouch for this single.
    const { data: vouch } = await admin
      .from('vouches')
      .select('id')
      .eq('voucher_id', voucherId)
      .eq('single_id', body.singleId)
      .maybeSingle();
    if (!vouch) throw new HttpError(403, 'You can only build a lineup for someone you vouch for');

    // Circle gate: honest, not punitive. The app shows progress; here we just enforce it.
    const { data: circle } = await admin.rpc('circle_size', { single: body.singleId });
    const circleSize = Number(circle ?? 0);
    if (circleSize < CIRCLE_UNLOCK) {
      throw new HttpError(409, `${CIRCLE_UNLOCK - circleSize} more vouchers needed before lineups unlock`);
    }

    // Candidates must be the voucher's connections, singles, not paused, not blocked,
    // and not already introduced. nominatable_for() does this for the app under RLS;
    // here we run as the service role so the checks are repeated by hand below.

    const { data: single } = await admin
      .from('profiles')
      .select('id, first_name, date_of_birth, city, bio, paused, role')
      .eq('id', body.singleId)
      .single();
    if (!single || single.role !== 'single') throw new HttpError(404, 'Single not found');
    if (single.paused) throw new HttpError(409, `${single.first_name} has paused Mash for now`);

    const { data: singleCriteria } = await admin.from('criteria').select('*').eq('single_id', body.singleId).maybeSingle();
    const { data: singleVouches } = await admin
      .from('vouches')
      .select('prompt, text, profiles:voucher_id(first_name)')
      .eq('single_id', body.singleId);

    const { data: candRows } = await admin
      .from('profiles')
      .select('id, first_name, date_of_birth, city, bio, paused, role, onboarding_complete')
      .in('id', candidateIds);

    const valid: typeof candRows = [];
    for (const c of candRows ?? []) {
      if (c.role !== 'single' || c.paused || !c.onboarding_complete) continue;
      const a = voucherId < c.id ? voucherId : c.id;
      const b = voucherId < c.id ? c.id : voucherId;
      const { data: conn } = await admin.from('connections').select('user_a').eq('user_a', a).eq('user_b', b).maybeSingle();
      if (!conn) continue;
      const { data: blocked } = await admin
        .from('blocks')
        .select('blocker_id')
        .or(`and(blocker_id.eq.${c.id},blocked_id.eq.${body.singleId}),and(blocker_id.eq.${body.singleId},blocked_id.eq.${c.id})`)
        .limit(1);
      if (blocked && blocked.length) continue;
      const { data: intro } = await admin
        .from('introductions')
        .select('id')
        .or(`and(single_id.eq.${body.singleId},candidate_id.eq.${c.id}),and(single_id.eq.${c.id},candidate_id.eq.${body.singleId})`)
        .limit(1);
      if (intro && intro.length) continue;
      valid.push(c);
    }
    if (valid.length === 0) throw new HttpError(400, 'None of those people can be on a lineup right now');

    const candidates: LineupCandidate[] = [];
    for (const c of valid) {
      const { data: crit } = await admin.from('criteria').select('*').eq('single_id', c.id).maybeSingle();
      const { data: vs } = await admin.from('vouches').select('prompt, text, profiles:voucher_id(first_name)').eq('single_id', c.id);
      const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
      const { count: declines } = await admin
        .from('lineup_entries')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', c.id)
        .eq('decision', 'not_this_time')
        .gte('decided_at', since);
      candidates.push({
        id: c.id,
        first_name: c.first_name,
        age: ageFrom(c.date_of_birth),
        city: c.city,
        bio: c.bio,
        criteria: crit ? pickCriteria(crit) : null,
        vouches: (vs ?? []).map(mapVouch),
        prior_declines: declines ?? 0,
      });
    }

    const { data: voucher } = await admin.from('profiles').select('first_name').eq('id', voucherId).single();

    const singleInput: LineupSingle = {
      first_name: single.first_name,
      age: ageFrom(single.date_of_birth),
      city: single.city,
      bio: single.bio,
      criteria: singleCriteria ? pickCriteria(singleCriteria) : null,
      vouches: (singleVouches ?? []).map(mapVouch),
    };

    // Create the lineup in "building" so the voucher sees it immediately.
    const { data: lineup, error: lineupErr } = await admin
      .from('lineups')
      .insert({ voucher_id: voucherId, single_id: body.singleId, status: 'building' })
      .select('id')
      .single();
    if (lineupErr || !lineup) throw lineupErr ?? new Error('Could not create lineup');

    let result;
    try {
      result = await buildLineup({
        voucherFirstName: voucher?.first_name ?? 'Your friend',
        single: singleInput,
        candidates,
        maxKept: MAX_KEPT,
      });
    } catch (err) {
      await admin.from('lineups').delete().eq('id', lineup.id);
      throw err;
    }

    const entries = [
      ...result.kept.map((k) => ({
        lineup_id: lineup.id,
        candidate_id: k.candidate_id,
        kept: true,
        rank: k.rank,
        reason: k.reason,
      })),
      ...result.dropped.map((d) => ({
        lineup_id: lineup.id,
        candidate_id: d.candidate_id,
        kept: false,
        rank: null,
        dropped_reason: d.reason,
      })),
    ];
    const { error: entErr } = await admin.from('lineup_entries').insert(entries);
    if (entErr) throw entErr;

    const status = result.kept.length > 0 ? 'ready' : 'done';
    await admin
      .from('lineups')
      .update({ status, agent_note_to_voucher: result.note_to_voucher, ready_at: new Date().toISOString() })
      .eq('id', lineup.id);

    if (result.kept.length > 0) {
      await notify(body.singleId, 'lineup_ready', `${voucher?.first_name ?? 'A friend'} has a lineup for you.`, {
        route: `/lineup/${lineup.id}`,
      });
    }

    const nameOf = (id: string) => candidates.find((c) => c.id === id)?.first_name ?? 'Someone';
    return json({
      lineupId: lineup.id,
      kept: result.kept.length,
      dropped: result.dropped.map((d) => ({ ...d, first_name: nameOf(d.candidate_id) })),
      note: result.note_to_voucher,
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
  return { voucher_first_name: name ?? 'A friend', prompt: v.prompt, text: v.text };
}
