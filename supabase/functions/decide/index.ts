// POST { entryId: string, decision: 'meet' | 'maybe' | 'not_this_time' }
//
// Two callers:
//   * The single, deciding on a lineup entry. "meet" creates a pending introduction and
//     shows the candidate the reverse: the single, vouched by the same friend.
//   * The candidate, answering that reverse introduction. If both said meet, the intro
//     becomes mutual, the chat opens with the vouch as its first message, and the voucher
//     hears the outcome in plain words.
//
// Declining sends nothing to the declined person. Ever.

import { admin, handler, json, readBody, requireUser, HttpError } from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';

interface Body {
  entryId?: string;
  introId?: string;
  decision: 'meet' | 'maybe' | 'not_this_time';
}

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (!['meet', 'maybe', 'not_this_time'].includes(body.decision)) throw new HttpError(400, 'Bad decision');

    if (body.entryId) return decideEntry(userId, body.entryId, body.decision);
    if (body.introId) return decideIntro(userId, body.introId, body.decision);
    throw new HttpError(400, 'entryId or introId required');
  }),
);

async function decideEntry(userId: string, entryId: string, decision: Body['decision']) {
  const { data: entry } = await admin
    .from('lineup_entries')
    .select('id, candidate_id, kept, decision, lineups:lineup_id(id, single_id, voucher_id)')
    .eq('id', entryId)
    .single();
  if (!entry) throw new HttpError(404, 'Not found');
  const lineup = entry.lineups as unknown as { id: string; single_id: string; voucher_id: string };
  if (lineup.single_id !== userId) throw new HttpError(403, 'Only the single decides');
  if (!entry.kept) throw new HttpError(400, 'That person is not on the lineup');

  await admin
    .from('lineup_entries')
    .update({ decision, decided_at: new Date().toISOString() })
    .eq('id', entryId);

  if (decision === 'meet') {
    // Create (or refresh) the introduction. Co-vouching: if another lineup already proposed
    // this pair, add the voucher rather than making a second intro.
    const { data: existing } = await admin
      .from('introductions')
      .select('id, voucher_ids, candidate_decision, status')
      .eq('single_id', userId)
      .eq('candidate_id', entry.candidate_id)
      .maybeSingle();

    const { data: me } = await admin.from('profiles').select('first_name').eq('id', userId).single();
    const { data: voucher } = await admin.from('profiles').select('first_name').eq('id', lineup.voucher_id).single();

    if (existing) {
      const vouchers = Array.from(new Set([...(existing.voucher_ids as string[]), lineup.voucher_id]));
      await admin
        .from('introductions')
        .update({ voucher_ids: vouchers, single_decision: 'meet' })
        .eq('id', existing.id);
      if (vouchers.length > (existing.voucher_ids as string[]).length) {
        // Two friends picked the same person: the strongest signal in the product.
        for (const v of vouchers) {
          await notify(v, 'comment', `Two of ${me?.first_name}'s friends picked the same person. That is the best sign there is.`, {
            route: `/lineup/${lineup.id}`,
          });
        }
      }
      if (existing.candidate_decision === 'meet') {
        await openChat(existing.id);
      }
      return json({ introId: existing.id, status: existing.candidate_decision === 'meet' ? 'mutual' : 'pending' });
    }

    const { data: intro, error } = await admin
      .from('introductions')
      .insert({
        single_id: userId,
        candidate_id: entry.candidate_id,
        voucher_ids: [lineup.voucher_id],
        lineup_entry_id: entryId,
        single_decision: 'meet',
        status: 'pending',
      })
      .select('id')
      .single();
    if (error || !intro) throw error ?? new Error('Could not create introduction');

    await notify(entry.candidate_id, 'lineup_ready', `${voucher?.first_name ?? 'A friend'} wants to introduce you to ${me?.first_name ?? 'someone'}.`, {
      route: `/intro/${intro.id}`,
    });
    return json({ introId: intro.id, status: 'pending' });
  }

  // The lineup is done when every kept entry has a non-maybe decision.
  const { data: remaining } = await admin
    .from('lineup_entries')
    .select('id')
    .eq('lineup_id', lineup.id)
    .eq('kept', true)
    .in('decision', ['undecided']);
  if (!remaining || remaining.length === 0) {
    await admin.from('lineups').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', lineup.id);
  }
  return json({ ok: true });
}

async function decideIntro(userId: string, introId: string, decision: Body['decision']) {
  const { data: intro } = await admin
    .from('introductions')
    .select('id, single_id, candidate_id, voucher_ids, single_decision, candidate_decision, status')
    .eq('id', introId)
    .single();
  if (!intro) throw new HttpError(404, 'Not found');
  if (intro.candidate_id !== userId) throw new HttpError(403, 'Only the person introduced can answer');
  if (intro.status !== 'pending') return json({ introId, status: intro.status });

  if (decision === 'not_this_time') {
    await admin
      .from('introductions')
      .update({ candidate_decision: decision, status: 'declined', closed_at: new Date().toISOString() })
      .eq('id', introId);
    // A kind automatic note to the voucher. The single never knows.
    const { data: cand } = await admin.from('profiles').select('first_name').eq('id', userId).single();
    for (const v of intro.voucher_ids as string[]) {
      await notify(v, 'outcome', `${cand?.first_name ?? 'They'} said not this time. Good instinct to try, though.`, {});
    }
    return json({ introId, status: 'declined' });
  }

  await admin.from('introductions').update({ candidate_decision: decision }).eq('id', introId);
  if (decision === 'meet' && intro.single_decision === 'meet') {
    await openChat(introId);
    return json({ introId, status: 'mutual' });
  }
  return json({ introId, status: 'pending' });
}

/** Both said meet. Open the chat with the vouch as the first message and tell everyone. */
async function openChat(introId: string) {
  const { data: intro } = await admin
    .from('introductions')
    .select('id, single_id, candidate_id, voucher_ids, status')
    .eq('id', introId)
    .single();
  if (!intro || intro.status === 'mutual') return;

  await admin
    .from('introductions')
    .update({ status: 'mutual', opened_at: new Date().toISOString() })
    .eq('id', introId);

  const voucherIds = intro.voucher_ids as string[];
  const { data: people } = await admin
    .from('profiles')
    .select('id, first_name')
    .in('id', [intro.single_id, intro.candidate_id, ...voucherIds]);
  const name = (id: string) => people?.find((p: { id: string }) => p.id === id)?.first_name ?? 'A friend';

  // The vouch about each person, from the first voucher, opens the chat.
  const { data: vouches } = await admin
    .from('vouches')
    .select('voucher_id, single_id, text')
    .in('voucher_id', voucherIds)
    .in('single_id', [intro.single_id, intro.candidate_id]);
  const lines: { intro_id: string; sender_id: null; body: string; is_vouch: boolean }[] = [];
  for (const v of vouches ?? []) {
    lines.push({
      intro_id: introId,
      sender_id: null,
      body: `${name(v.voucher_id)} on ${name(v.single_id)}: ${v.text}`,
      is_vouch: true,
    });
  }
  if (lines.length === 0) {
    lines.push({
      intro_id: introId,
      sender_id: null,
      body: `${name(voucherIds[0] ?? '')} introduced you both.`,
      is_vouch: true,
    });
  }
  await admin.from('messages').insert(lines);

  const s = name(intro.single_id);
  const c = name(intro.candidate_id);
  await notify(intro.single_id, 'intro_mutual', `${c} said yes. Say hello.`, { route: `/intro/${introId}` });
  await notify(intro.candidate_id, 'intro_mutual', `${s} said yes. Say hello.`, { route: `/intro/${introId}` });
  for (const v of voucherIds) {
    await notify(v, 'outcome', `${s} and ${c} are talking. You did that.`, { route: '/(voucher)/record' });
  }
}
