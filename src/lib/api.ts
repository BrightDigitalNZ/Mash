// Every write the app makes, in one place, typed. Screens call these and never build queries.
// Vocabulary: Mashmaker, Catch, Machine, batch, mash. "vouch" is the verb for the Mashmaker's note.

import { Share } from 'react-native';

import { Events, track } from './analytics';
import { DEMO, demoApi } from './demo';
import { callFunction, supabase } from './supabase';
import {
  isNorthMetric,
  noteProblems,
  statusForOutcome,
} from '../../supabase/functions/_shared/rules';
import type {
  Brief,
  Criteria,
  EntryDecision,
  GenderKind,
  IntentKind,
  LinkedKind,
  MashStatus,
  OutcomeKind,
  PublicProfile,
  ShareLevel,
} from '@/types/database';

// --- edge functions ---------------------------------------------------------

export interface MatchContactsResult {
  matched: (PublicProfile & { role: 'catch' | 'mashmaker' | null; hash: string | null })[];
  pendingInvites: { inviter_first_name: string; message: string | null }[];
}

/** Explicit re-sync only. Never silent. */
export async function matchContacts(hashes: string[], myPhoneHash?: string) {
  if (DEMO) return demoApi.matchContacts(hashes, myPhoneHash);
  const res = await callFunction<MatchContactsResult>('match-contacts', { hashes, myPhoneHash });
  track(Events.contactsMatched, { matched: res.matched.length, hashes: hashes.length });
  return res;
}

export interface BuildBatchResult {
  batchId: string;
  kept: number;
  dropped: { candidate_id: string; first_name: string; reason: string }[];
  note: string;
}

export async function buildBatch(catchId: string, candidateIds: string[]) {
  if (DEMO) return demoApi.buildBatch(catchId, candidateIds);
  track(Events.batchRequested, { nominated: candidateIds.length });
  return callFunction<BuildBatchResult>('build-batch', { catchId, candidateIds });
}

export type Decision = Exclude<EntryDecision, 'undecided'>;

/** A nominee's yes in principle, before the Catch sees them. */
export async function answerConsent(entryId: string, consent: 'yes' | 'no') {
  if (DEMO) return demoApi.answerConsent(entryId, consent);
  track(Events.consentAnswered, { consent });
  return callFunction<{ ok: true; consent: 'yes' | 'no' }>('decide', { entryId, consent });
}

export async function decideEntry(entryId: string, decision: Decision) {
  if (DEMO) return demoApi.decideEntry(entryId, decision);
  track(Events.entryDecided, { decision });
  return callFunction<{ ok: true; mashId?: string; status?: MashStatus }>('decide', {
    entryId,
    decision,
  });
}

export async function decideMash(mashId: string, decision: 'meet' | 'pass') {
  if (DEMO) return demoApi.decideMash(mashId, decision);
  track(Events.entryDecided, { decision, reverse: true });
  const res = await callFunction<{ mashId: string; status: MashStatus }>('decide', {
    mashId,
    decision,
  });
  if (res.status === 'mutual') track(Events.mashMutual);
  return res;
}

/** The Machine's checks on the other person. Requester only. */
export async function requestBrief(mashId: string) {
  if (DEMO) return demoApi.requestBrief(mashId);
  track(Events.checksRequested);
  return callFunction<{ brief: Pick<Brief, 'id' | 'content' | 'generated_at'> }>('brief', {
    mashId,
  });
}

// --- profile and criteria ---------------------------------------------------

export async function saveCriteria(
  catchId: string,
  criteria: {
    age_min: number;
    age_max: number;
    radius_km: number;
    dealbreakers: string[];
    intent: IntentKind;
    open_text: string | null;
  },
) {
  if (DEMO) return demoApi.saveCriteria(catchId, criteria);
  const { data, error } = await supabase
    .from('criteria')
    .upsert({ catch_id: catchId, ...criteria }, { onConflict: 'catch_id' })
    .select('*')
    .single();
  if (error) throw error;
  track(Events.criteriaSaved);
  return data as Criteria;
}

export type { GenderKind };

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  if (DEMO) return demoApi.uploadAvatar(userId, localUri);
  const res = await fetch(localUri);
  const blob = await res.arrayBuffer();
  const path = `${userId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// --- Mashmaker links: a Catch asks, the Mashmaker accepts. Neither can be assigned. ---

export async function askMashmaker(catchId: string, mashmakerId: string) {
  if (DEMO) return demoApi.askMashmaker(catchId, mashmakerId);
  const { error } = await supabase
    .from('mashmaker_links')
    .upsert(
      { catch_id: catchId, mashmaker_id: mashmakerId, requested_by: catchId, status: 'requested' },
      { onConflict: 'catch_id,mashmaker_id' },
    );
  if (error) throw error;
  track(Events.mashmakerAsked);
}

/** A Mashmaker offering to a Catch already on Mash. The Catch still has to accept. */
export async function offerToMashmake(mashmakerId: string, catchId: string) {
  if (DEMO) return demoApi.offerToMashmake(mashmakerId, catchId);
  const { error } = await supabase
    .from('mashmaker_links')
    .upsert(
      {
        catch_id: catchId,
        mashmaker_id: mashmakerId,
        requested_by: mashmakerId,
        status: 'requested',
      },
      { onConflict: 'catch_id,mashmaker_id' },
    );
  if (error) throw error;
}

export async function answerMashmakerRequest(linkId: string, accept: boolean) {
  if (DEMO) return demoApi.answerMashmakerRequest(linkId, accept);
  const { error } = await supabase
    .from('mashmaker_links')
    .update({ status: accept ? 'accepted' : 'declined', answered_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
  if (accept) track(Events.mashmakerAccepted);
}

export async function endMashmakerLink(linkId: string) {
  if (DEMO) return demoApi.endMashmakerLink(linkId);
  const { error } = await supabase
    .from('mashmaker_links')
    .update({ status: 'ended', answered_at: new Date().toISOString() })
    .eq('id', linkId);
  if (error) throw error;
}

// --- vouching and inviting --------------------------------------------------

/** Rule 3: say why, about the two people. Screened before it is saved. */
export function checkNote(text: string, minLength = 20): string[] {
  return noteProblems(text, minLength);
}

export async function writeVouch(args: {
  mashmakerId: string;
  catchId: string;
  promptId: number | null;
  prompt: string;
  text: string;
  howKnown?: string | null;
  minLength?: number;
}) {
  const problems = checkNote(args.text, args.minLength ?? 20);
  if (problems.length) throw new Error(problems[0]);
  if (DEMO) return demoApi.writeVouch(args);
  const { error } = await supabase
    .from('vouches')
    .upsert(
      {
        mashmaker_id: args.mashmakerId,
        catch_id: args.catchId,
        prompt_id: args.promptId,
        prompt: args.prompt,
        text: args.text.trim(),
        how_known: args.howKnown ?? null,
      },
      { onConflict: 'mashmaker_id,catch_id' },
    );
  if (error) throw error;
  track(Events.vouchWritten);
}

export async function removeVouch(mashmakerId: string, catchId: string) {
  if (DEMO) return demoApi.removeVouch(mashmakerId, catchId);
  const { error } = await supabase
    .from('vouches')
    .delete()
    .eq('mashmaker_id', mashmakerId)
    .eq('catch_id', catchId);
  if (error) throw error;
}

/**
 * Invite someone not on Mash. Stored only as their hash, then the system share sheet opens
 * with the invite in the inviter's own words, from their own phone. Identifies the sender.
 */
export async function inviteByHash(args: {
  inviterId: string;
  inviterFirstName: string;
  inviteeHash: string;
  inviteeName: string;
  message: string;
}) {
  if (DEMO) return demoApi.inviteByHash(args);
  const { data, error } = await supabase
    .from('invites')
    .upsert(
      {
        inviter_id: args.inviterId,
        invitee_hash: args.inviteeHash,
        message: args.message,
        status: 'pending',
      },
      { onConflict: 'inviter_id,invitee_hash' },
    )
    .select('invite_code')
    .single();
  if (error) throw error;
  const link = `https://mash.dating/i/${data.invite_code}`;
  await Share.share({
    message: `${args.message.trim()}\n\n${link}\n\nFrom ${args.inviterFirstName} on Mash. Ignore this and nothing happens.`,
  });
  track(Events.inviteSent);
  return data.invite_code as string;
}

// --- batches ----------------------------------------------------------------

export async function commentOnBatch(args: {
  batchId: string;
  entryId: string | null;
  authorId: string;
  text: string;
}) {
  if (DEMO) return demoApi.commentOnBatch(args);
  const { error } = await supabase
    .from('batch_comments')
    .insert({
      batch_id: args.batchId,
      entry_id: args.entryId,
      author_id: args.authorId,
      text: args.text.trim(),
    });
  if (error) throw error;
  track(Events.commentLeft);
}

export async function markRevealed(entryId: string) {
  if (DEMO) return demoApi.markRevealed(entryId);
  await supabase
    .from('batch_entries')
    .update({ revealed_at: new Date().toISOString() })
    .eq('id', entryId)
    .is('revealed_at', null);
}

/** The Mashmaker may bring back one person the Machine set aside. They are then asked like anyone else. */
export async function overrideDrop(entryId: string) {
  if (DEMO) return demoApi.overrideDrop(entryId);
  const { error } = await supabase
    .from('batch_entries')
    .update({ kept: true, mashmaker_overrode: true, position: 99, consent: 'pending' })
    .eq('id', entryId);
  if (error) throw error;
}

/** A Mashmaker withdrawing an open nomination, quietly. */
export async function withdrawNomination(entryId: string) {
  if (DEMO) return demoApi.withdrawNomination(entryId);
  const { error } = await supabase
    .from('batch_entries')
    .update({ kept: false, dropped_reason: 'Withdrawn by the Mashmaker.' })
    .eq('id', entryId);
  if (error) throw error;
  // A pending mash from this nomination stops too. Both Catches see "this one didn't go ahead".
  await supabase
    .from('mashes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('batch_entry_id', entryId)
    .eq('status', 'pending');
}

/** The rules shown at onboarding. Accepted once per role, recorded on the profile. */
export async function acceptRules(userId: string, role: 'catch' | 'mashmaker') {
  if (DEMO) return;
  const at = new Date().toISOString();
  const patch =
    role === 'catch' ? { catch_rules_accepted_at: at } : { mashmaker_rules_accepted_at: at };
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

// --- chat and outcomes ------------------------------------------------------

export async function sendMessage(mashId: string, senderId: string, body: string) {
  if (DEMO) return demoApi.sendMessage(mashId, senderId, body);
  const { error } = await supabase
    .from('messages')
    .insert({ mash_id: mashId, sender_id: senderId, body: body.trim() });
  if (error) throw error;
}

/** Light report back. The Catch chooses, each time, what their Mashmakers learn. */
export async function reportOutcome(args: {
  mashId: string;
  reportedBy: string;
  outcome: OutcomeKind;
  share: ShareLevel;
  note?: string;
  whenAt?: string;
}) {
  if (DEMO) return demoApi.reportOutcome(args);
  const { error } = await supabase
    .from('outcomes')
    .insert({
      mash_id: args.mashId,
      reported_by: args.reportedBy,
      outcome: args.outcome,
      share: args.share,
      note: args.note ?? null,
      when_at: args.whenAt ?? null,
    });
  if (error) throw error;
  const status = statusForOutcome(args.outcome);
  if (status) await supabase.from('mashes').update({ status }).eq('id', args.mashId);
  track(Events.outcomeReported, { outcome: args.outcome, share: args.share });
  if (isNorthMetric(args.outcome)) track(Events.metAndWentAgain);
}

export async function closeMash(mashId: string) {
  if (DEMO) return demoApi.closeMash(mashId);
  const { error } = await supabase
    .from('mashes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', mashId);
  if (error) throw error;
}

// --- safety -----------------------------------------------------------------

export async function blockUser(blockerId: string, blockedId: string) {
  if (DEMO) return demoApi.blockUser(blockerId, blockedId);
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  track(Events.blocked);
}

/** Goes to the safety team, never to a Mashmaker. The reporter chooses what their Mashmakers learn. */
export async function reportUser(args: {
  reporterId: string;
  reportedId: string;
  reason: string;
  details?: string;
  share: ShareLevel;
}) {
  if (DEMO) return demoApi.reportUser(args);
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id: args.reporterId,
      reported_id: args.reportedId,
      reason: args.reason,
      details: args.details ?? null,
      share: args.share,
    });
  if (error) throw error;
  track(Events.reported, { reason: args.reason });
}

/** Exclusion list: a hashed number that must never be surfaced to or by me. Silent, permanent. */
export async function addExclusion(ownerId: string, hash: string) {
  if (DEMO) return demoApi.addExclusion(ownerId, hash);
  const { error } = await supabase.from('excluded_hashes').upsert({ owner_id: ownerId, hash });
  if (error) throw error;
  track(Events.excluded);
}

export async function removeExclusion(ownerId: string, hash: string) {
  if (DEMO) return demoApi.removeExclusion(ownerId, hash);
  const { error } = await supabase
    .from('excluded_hashes')
    .delete()
    .eq('owner_id', ownerId)
    .eq('hash', hash);
  if (error) throw error;
}

// --- linked profiles (what the Machine may read, with consent) ---------------

export async function addLinkedProfile(userId: string, kind: LinkedKind, url: string) {
  if (DEMO) return demoApi.addLinkedProfile(userId, kind, url);
  const { error } = await supabase
    .from('linked_profiles')
    .upsert({ user_id: userId, kind, url: url.trim() }, { onConflict: 'user_id,url' });
  if (error) throw error;
}

export async function removeLinkedProfile(id: string) {
  if (DEMO) return demoApi.removeLinkedProfile(id);
  const { error } = await supabase.from('linked_profiles').delete().eq('id', id);
  if (error) throw error;
}

// --- notifications ----------------------------------------------------------

export async function markNotificationsRead(ids: string[]) {
  if (DEMO) return demoApi.markNotificationsRead(ids);
  if (ids.length === 0) return;
  await supabase.from('notifications').update({ read: true }).in('id', ids);
}

// --- pricing (Brief section 9) ----------------------------------------------

export const PRICING = {
  monthly: { label: 'Monthly', price: '$19.95', per: 'a month' },
  quarterly: {
    label: 'Three months',
    price: '$49.95',
    per: 'every three months',
    saving: 'Save $9.90',
  },
  trialDays: 21,
} as const;
