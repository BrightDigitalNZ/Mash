// POST one of:
//   { entryId, consent: 'yes' | 'no' }           a nominee answering "okay to be shown?"
//   { entryId, decision: 'meet'|'maybe'|'pass' } the Catch deciding on a revealed entry
//   { mashId,  decision: 'meet'|'pass' }         the other Catch answering a mash
//
// Consent at every step; mutual acceptance before any contact; decline without explanation,
// always. A pass tells the other person nothing. The Mashmaker learns "accepted / declined"
// only, and only what the Catch's visibility setting allows.

import {
  admin,
  handler,
  json,
  readBody,
  requireUser,
  setting,
  HttpError,
} from '../_shared/supabase.ts';
import { notify } from '../_shared/push.ts';

interface Body {
  entryId?: string;
  mashId?: string;
  consent?: 'yes' | 'no';
  decision?: 'meet' | 'maybe' | 'pass';
}

Deno.serve(
  handler(async (req) => {
    const userId = await requireUser(req);
    const body = await readBody<Body>(req);
    if (body.entryId && body.consent) return answerConsent(userId, body.entryId, body.consent);
    if (body.entryId && body.decision) return decideEntry(userId, body.entryId, body.decision);
    if (body.mashId && body.decision) return decideMash(userId, body.mashId, body.decision);
    throw new HttpError(400, 'entryId with consent or decision, or mashId with decision');
  }),
);

async function loadEntry(entryId: string) {
  const { data: entry } = await admin
    .from('batch_entries')
    .select(
      'id, candidate_id, kept, consent, decision, batches:batch_id(id, catch_id, mashmaker_id, status)',
    )
    .eq('id', entryId)
    .single();
  if (!entry) throw new HttpError(404, 'Not found');
  const batch = entry.batches as unknown as {
    id: string;
    catch_id: string;
    mashmaker_id: string;
    status: string;
  };
  return { entry, batch };
}

/** The nominee's yes in principle. Only then does the Catch see them. */
async function answerConsent(userId: string, entryId: string, consent: 'yes' | 'no') {
  const { entry, batch } = await loadEntry(entryId);
  if (entry.candidate_id !== userId) throw new HttpError(403, 'Only the person asked can answer');
  if (entry.consent !== 'pending') return json({ ok: true, consent: entry.consent });

  await admin
    .from('batch_entries')
    .update({ consent, consent_at: new Date().toISOString() })
    .eq('id', entryId);

  if (consent === 'yes' && batch.status === 'consenting') {
    // First yes makes the batch visible to the Catch.
    await admin
      .from('batches')
      .update({ status: 'ready', ready_at: new Date().toISOString() })
      .eq('id', batch.id);
    const { data: mm } = await admin
      .from('profiles')
      .select('first_name')
      .eq('id', batch.mashmaker_id)
      .single();
    await notify(
      batch.catch_id,
      'batch_ready',
      `${mm?.first_name ?? 'Your Mashmaker'} has a batch for you.`,
      { route: `/batch/${batch.id}` },
    );
  }

  // If everyone has answered and nobody said yes, the batch is done. The Mashmaker sees counts only.
  const { data: remaining } = await admin
    .from('batch_entries')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('kept', true)
    .eq('consent', 'pending');
  const { data: yeses } = await admin
    .from('batch_entries')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('kept', true)
    .eq('consent', 'yes');
  if ((!remaining || remaining.length === 0) && (!yeses || yeses.length === 0)) {
    await admin
      .from('batches')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', batch.id);
  }
  return json({ ok: true, consent });
}

/** The Catch decides on a revealed entry. "meet" creates a pending mash and asks the other side. */
async function decideEntry(userId: string, entryId: string, decision: 'meet' | 'maybe' | 'pass') {
  const { entry, batch } = await loadEntry(entryId);
  if (batch.catch_id !== userId) throw new HttpError(403, 'Only the Catch decides');
  if (!entry.kept || entry.consent !== 'yes')
    throw new HttpError(400, 'That person is not in the batch');

  await admin
    .from('batch_entries')
    .update({ decision, decided_at: new Date().toISOString() })
    .eq('id', entryId);

  let mashId: string | undefined;
  let status: string | undefined;
  if (decision === 'meet') {
    const { data: existing } = await admin
      .from('mashes')
      .select('id, mashmaker_ids, candidate_decision, status')
      .eq('catch_id', userId)
      .eq('candidate_id', entry.candidate_id)
      .maybeSingle();
    const { data: me } = await admin
      .from('profiles')
      .select('first_name')
      .eq('id', userId)
      .single();
    const { data: mm } = await admin
      .from('profiles')
      .select('first_name')
      .eq('id', batch.mashmaker_id)
      .single();

    if (existing) {
      const mashmakers = Array.from(
        new Set([...(existing.mashmaker_ids as string[]), batch.mashmaker_id]),
      );
      await admin
        .from('mashes')
        .update({ mashmaker_ids: mashmakers, catch_decision: 'meet' })
        .eq('id', existing.id);
      if (existing.candidate_decision === 'meet') await openConversation(existing.id);
      mashId = existing.id;
      status = existing.candidate_decision === 'meet' ? 'mutual' : 'pending';
    } else {
      // OPEN: how long a pending mash waits. A server-side switch, default 7 days.
      const expiryDays = Number(await setting('intro_expiry_days', '7'));
      const { data: mash, error } = await admin
        .from('mashes')
        .insert({
          catch_id: userId,
          candidate_id: entry.candidate_id,
          mashmaker_ids: [batch.mashmaker_id],
          batch_entry_id: entryId,
          catch_decision: 'meet',
          status: 'pending',
          expires_at: new Date(Date.now() + expiryDays * 86400000).toISOString(),
        })
        .select('id')
        .single();
      if (error || !mash) throw error ?? new Error('Could not create mash');
      mashId = mash.id;
      status = 'pending';
      await notify(
        entry.candidate_id,
        'batch_ready',
        `${mm?.first_name ?? 'A friend'} has picked you for ${me?.first_name ?? 'someone'}. Here’s why.`,
        { route: `/mash/${mash.id}` },
      );
    }
  }

  const { data: undecided } = await admin
    .from('batch_entries')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('kept', true)
    .eq('consent', 'yes')
    .eq('decision', 'undecided');
  const { data: pendingConsent } = await admin
    .from('batch_entries')
    .select('id')
    .eq('batch_id', batch.id)
    .eq('kept', true)
    .eq('consent', 'pending');
  if ((!undecided || undecided.length === 0) && (!pendingConsent || pendingConsent.length === 0)) {
    await admin
      .from('batches')
      .update({ status: 'done', done_at: new Date().toISOString() })
      .eq('id', batch.id);
  }
  return json({ ok: true, mashId, status });
}

/** The other Catch answers. A pass tells nobody why. */
async function decideMash(userId: string, mashId: string, decision: 'meet' | 'maybe' | 'pass') {
  const { data: mash } = await admin
    .from('mashes')
    .select('id, catch_id, candidate_id, mashmaker_ids, catch_decision, candidate_decision, status')
    .eq('id', mashId)
    .single();
  if (!mash) throw new HttpError(404, 'Not found');
  if (mash.candidate_id !== userId) throw new HttpError(403, 'Only the person mashed can answer');
  if (mash.status !== 'pending') return json({ mashId, status: mash.status });

  if (decision === 'pass') {
    await admin
      .from('mashes')
      .update({
        candidate_decision: 'pass',
        status: 'declined',
        closed_at: new Date().toISOString(),
      })
      .eq('id', mashId);
    // The Mashmaker learns "declined", nothing more. Not dressed up.
    for (const m of mash.mashmaker_ids as string[]) {
      await notify(m, 'outcome', 'This one didn’t go ahead.', { route: '/(mashmaker)/record' });
    }
    return json({ mashId, status: 'declined' });
  }

  await admin.from('mashes').update({ candidate_decision: decision }).eq('id', mashId);
  if (decision === 'meet' && mash.catch_decision === 'meet') {
    await openConversation(mashId);
    return json({ mashId, status: 'mutual' });
  }
  return json({ mashId, status: 'pending' });
}

/** Both said yes. The conversation opens with the Mashmaker's line. Both know who introduced them. */
async function openConversation(mashId: string) {
  const { data: mash } = await admin
    .from('mashes')
    .select('id, catch_id, candidate_id, mashmaker_ids, status')
    .eq('id', mashId)
    .single();
  if (!mash || mash.status === 'mutual') return;
  await admin
    .from('mashes')
    .update({ status: 'mutual', opened_at: new Date().toISOString() })
    .eq('id', mashId);

  const mashmakerIds = mash.mashmaker_ids as string[];
  const { data: people } = await admin
    .from('profiles')
    .select('id, first_name')
    .in('id', [mash.catch_id, mash.candidate_id, ...mashmakerIds]);
  const name = (id: string) =>
    people?.find((p: { id: string }) => p.id === id)?.first_name ?? 'A friend';

  const { data: vouches } = await admin
    .from('vouches')
    .select('mashmaker_id, catch_id, text')
    .in('mashmaker_id', mashmakerIds)
    .in('catch_id', [mash.catch_id, mash.candidate_id]);
  const lines = (vouches ?? []).map(
    (v: { mashmaker_id: string; catch_id: string; text: string }) => ({
      mash_id: mashId,
      sender_id: null,
      body: `${name(v.mashmaker_id)} on ${name(v.catch_id)}: ${v.text}`,
      is_vouch: true,
    }),
  );
  if (lines.length === 0)
    lines.push({
      mash_id: mashId,
      sender_id: null,
      body: `${name(mashmakerIds[0] ?? '')} mashed you.`,
      is_vouch: true,
    });
  await admin.from('messages').insert(lines);

  const c = name(mash.catch_id);
  const d = name(mash.candidate_id);
  await notify(mash.catch_id, 'mash_mutual', `${d} said yes. Say hello.`, {
    route: `/mash/${mashId}`,
  });
  await notify(mash.candidate_id, 'mash_mutual', `${c} said yes. Say hello.`, {
    route: `/mash/${mashId}`,
  });
  for (const m of mashmakerIds) {
    await notify(m, 'outcome', `${c} and ${d} both said yes. You did that.`, {
      route: '/(mashmaker)/record',
    });
  }
}
