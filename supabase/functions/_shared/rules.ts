// Pure business rules shared by the edge functions. No imports, so they are unit-tested
// from the app's Jest run as well as used by Deno.

export interface KeptPick {
  candidate_id: string;
  rank: number;
  reason: string;
}

export interface DroppedPick {
  candidate_id: string;
  reason: string;
}

export interface LineupDecision {
  kept: KeptPick[];
  dropped: DroppedPick[];
  note_to_voucher: string;
}

/**
 * Make the model's answer safe to store: only ids we sent, no duplicates, kept capped and
 * re-ranked 1..n, and nobody silently lost (anyone unmentioned is dropped with a neutral reason).
 */
export function sanitiseLineup(
  raw: LineupDecision,
  candidateIds: readonly string[],
  maxKept: number,
): LineupDecision {
  const ids = new Set(candidateIds);
  const seen = new Set<string>();
  const kept = raw.kept
    .filter((k) => ids.has(k.candidate_id))
    .filter((k) => {
      if (seen.has(k.candidate_id)) return false;
      seen.add(k.candidate_id);
      return true;
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxKept)
    .map((k, i) => ({ ...k, rank: i + 1 }));
  const keptIds = new Set(kept.map((k) => k.candidate_id));

  const dropped: DroppedPick[] = [];
  const droppedIds = new Set<string>();
  for (const d of raw.dropped) {
    if (!ids.has(d.candidate_id) || keptIds.has(d.candidate_id) || droppedIds.has(d.candidate_id)) continue;
    droppedIds.add(d.candidate_id);
    dropped.push(d);
  }
  for (const id of candidateIds) {
    if (!keptIds.has(id) && !droppedIds.has(id)) {
      droppedIds.add(id);
      dropped.push({ candidate_id: id, reason: 'Not a fit for this lineup.' });
    }
  }
  return { kept, dropped, note_to_voucher: raw.note_to_voucher };
}

/** The agent's nudge to a voucher, or null when there is nothing worth saying. */
export function nudgeText(args: {
  singleFirstName: string;
  circleSize: number;
  unlockAt: number;
  lineupsFromThisVoucher: number;
  lineupsFromOthers: number;
  nominatable: number;
}): string | null {
  const { singleFirstName, circleSize, unlockAt, lineupsFromThisVoucher, lineupsFromOthers, nominatable } = args;
  if (circleSize < unlockAt) {
    const short = unlockAt - circleSize;
    return `${singleFirstName}'s circle is ${circleSize}. Matches unlock at ${unlockAt}. Know ${
      short === 1 ? 'one more person' : `${short} more people`
    } who would vouch for them?`;
  }
  if (lineupsFromThisVoucher === 0 && nominatable > 0) {
    return `You have ${nominatable === 1 ? 'one friend' : `${nominatable} friends`} who could be on a lineup for ${singleFirstName}. Want to put one together?`;
  }
  if (lineupsFromThisVoucher === 0 && lineupsFromOthers > 0) {
    return `${singleFirstName}'s had ${lineupsFromOthers === 1 ? 'one lineup' : `${lineupsFromOthers} lineups`} from others. Yours is still to come.`;
  }
  return null;
}

/** Normalise a pair of user ids so (a, b) and (b, a) store as one connection row. */
export function orderedPair(a: string, b: string): { user_a: string; user_b: string } {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

/** Which intro status an outcome report implies, or null for "no change". */
export function statusForOutcome(
  outcome: 'meeting' | 'met' | 'no_show' | 'dating' | 'together' | 'ended' | 'not_for_me',
): 'met' | 'closed' | null {
  if (outcome === 'met' || outcome === 'dating' || outcome === 'together') return 'met';
  if (outcome === 'ended' || outcome === 'not_for_me') return 'closed';
  return null;
}
