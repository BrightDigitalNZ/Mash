// Every write the app makes, in one place, typed. Screens call these and never build queries.

import { Share } from 'react-native';

import { Events, track } from './analytics';
import { callFunction, supabase } from './supabase';
import { statusForOutcome } from '../../supabase/functions/_shared/rules';
import type {
  Brief,
  Criteria,
  EntryDecision,
  IntentKind,
  IntroStatus,
  LinkedKind,
  OutcomeKind,
  PublicProfile,
} from '@/types/database';

// --- edge functions ---------------------------------------------------------

export interface MatchContactsResult {
  matched: (PublicProfile & { role: 'single' | 'voucher' | null })[];
  pendingInvites: { voucher_first_name: string; invite_message: string | null }[];
}

export async function matchContacts(hashes: string[], myPhoneHash?: string) {
  const res = await callFunction<MatchContactsResult>('match-contacts', { hashes, myPhoneHash });
  track(Events.contactsMatched, { matched: res.matched.length, hashes: hashes.length });
  return res;
}

export interface BuildLineupResult {
  lineupId: string;
  kept: number;
  dropped: { candidate_id: string; first_name: string; reason: string }[];
  note: string;
}

export async function buildLineup(singleId: string, candidateIds: string[]) {
  track(Events.lineupRequested, { nominated: candidateIds.length });
  return callFunction<BuildLineupResult>('build-lineup', { singleId, candidateIds });
}

export type Decision = Exclude<EntryDecision, 'undecided'>;

export async function decideEntry(entryId: string, decision: Decision) {
  track(Events.entryDecided, { decision });
  return callFunction<{ introId?: string; status?: IntroStatus; ok?: boolean }>('decide', {
    entryId,
    decision,
  });
}

export async function decideIntro(introId: string, decision: Decision) {
  track(Events.entryDecided, { decision, reverse: true });
  const res = await callFunction<{ introId: string; status: IntroStatus }>('decide', {
    introId,
    decision,
  });
  if (res.status === 'mutual') track(Events.introMutual);
  return res;
}

export async function generateBrief(introId: string) {
  return callFunction<{ brief: Pick<Brief, 'id' | 'content' | 'subject_approved'> }>('brief', {
    introId,
    action: 'generate',
  });
}

export async function approveBrief(introId: string) {
  return callFunction<{ ok: true }>('brief', { introId, action: 'approve' });
}

// --- profile and criteria ---------------------------------------------------

export async function saveCriteria(
  singleId: string,
  criteria: {
    age_min: number;
    age_max: number;
    radius_km: number;
    dealbreakers: string[];
    intent: IntentKind;
    open_text: string | null;
  },
) {
  const { data, error } = await supabase
    .from('criteria')
    .upsert({ single_id: singleId, ...criteria }, { onConflict: 'single_id' })
    .select('*')
    .single();
  if (error) throw error;
  track(Events.criteriaSaved);
  return data as Criteria;
}

export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
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

// --- vouching and nominating ------------------------------------------------

export async function writeVouch(args: {
  voucherId: string;
  singleId: string;
  promptId: number | null;
  prompt: string;
  text: string;
  howKnown?: string | null;
}) {
  const { error } = await supabase.from('vouches').upsert(
    {
      voucher_id: args.voucherId,
      single_id: args.singleId,
      prompt_id: args.promptId,
      prompt: args.prompt,
      text: args.text.trim(),
      how_known: args.howKnown ?? null,
    },
    { onConflict: 'voucher_id,single_id' },
  );
  if (error) throw error;
  track(Events.vouchWritten);
}

export async function removeVouch(voucherId: string, singleId: string) {
  const { error } = await supabase
    .from('vouches')
    .delete()
    .eq('voucher_id', voucherId)
    .eq('single_id', singleId);
  if (error) throw error;
}

/**
 * Nominate someone who is not on Mash yet. Stores only their hash, then opens the
 * system share sheet with an invite in the voucher's own words.
 */
export async function inviteByHash(args: {
  voucherId: string;
  voucherFirstName: string;
  nomineeHash: string;
  nomineeName: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from('nominations')
    .upsert(
      {
        voucher_id: args.voucherId,
        nominee_hash: args.nomineeHash,
        invite_message: args.message,
        status: 'pending',
      },
      { onConflict: 'voucher_id,nominee_hash' },
    )
    .select('invite_code')
    .single();
  if (error) throw error;

  const link = `https://mash.dating/i/${data.invite_code}`;
  const body = `${args.message.trim()}\n\n${link}`;
  await Share.share({ message: body });
  track(Events.inviteSent);
  return data.invite_code as string;
}

// --- lineups ----------------------------------------------------------------

export async function commentOnLineup(args: {
  lineupId: string;
  entryId: string | null;
  authorId: string;
  text: string;
}) {
  const { error } = await supabase.from('lineup_comments').insert({
    lineup_id: args.lineupId,
    entry_id: args.entryId,
    author_id: args.authorId,
    text: args.text.trim(),
  });
  if (error) throw error;
  track(Events.commentLeft);
}

export async function markRevealed(entryId: string) {
  await supabase
    .from('lineup_entries')
    .update({ revealed_at: new Date().toISOString() })
    .eq('id', entryId)
    .is('revealed_at', null);
}

/** The voucher may bring back one dropped person. */
export async function overrideDrop(entryId: string) {
  const { error } = await supabase
    .from('lineup_entries')
    .update({ kept: true, voucher_overrode: true, rank: 99 })
    .eq('id', entryId);
  if (error) throw error;
}

// --- chat and outcomes ------------------------------------------------------

export async function sendMessage(introId: string, senderId: string, body: string) {
  const { error } = await supabase
    .from('messages')
    .insert({ intro_id: introId, sender_id: senderId, body: body.trim() });
  if (error) throw error;
}

export async function reportOutcome(args: {
  introId: string;
  reportedBy: string;
  outcome: OutcomeKind;
  note?: string;
  whenAt?: string;
}) {
  const { error } = await supabase.from('outcomes').insert({
    intro_id: args.introId,
    reported_by: args.reportedBy,
    outcome: args.outcome,
    note: args.note ?? null,
    when_at: args.whenAt ?? null,
  });
  if (error) throw error;
  const status: IntroStatus | null = statusForOutcome(args.outcome);
  if (status) {
    await supabase.from('introductions').update({ status }).eq('id', args.introId);
  }
  track(Events.outcomeReported, { outcome: args.outcome });
}

export async function unmatch(introId: string) {
  const { error } = await supabase
    .from('introductions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', introId);
  if (error) throw error;
}

// --- safety -----------------------------------------------------------------

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
  track(Events.blocked);
}

export async function reportUser(args: {
  reporterId: string;
  reportedId: string;
  reason: string;
  details?: string;
}) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: args.reporterId,
    reported_id: args.reportedId,
    reason: args.reason,
    details: args.details ?? null,
  });
  if (error) throw error;
  track(Events.reported, { reason: args.reason });
}

// --- linked profiles (for the consent-first brief) --------------------------

export async function addLinkedProfile(userId: string, kind: LinkedKind, url: string) {
  const { error } = await supabase
    .from('linked_profiles')
    .upsert({ user_id: userId, kind, url: url.trim() }, { onConflict: 'user_id,url' });
  if (error) throw error;
}

export async function removeLinkedProfile(id: string) {
  const { error } = await supabase.from('linked_profiles').delete().eq('id', id);
  if (error) throw error;
}

// --- notifications ----------------------------------------------------------

export async function markNotificationsRead(ids: string[]) {
  if (ids.length === 0) return;
  await supabase.from('notifications').update({ read: true }).in('id', ids);
}
