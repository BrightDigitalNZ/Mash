// Pure business rules shared by the edge functions. No imports, so they are unit-tested
// from the app's Jest run as well as used by Deno.

export interface KeptPick {
  candidate_id: string;
  position: number;
  reason: string;
}

export interface DroppedPick {
  candidate_id: string;
  reason: string;
}

export interface BatchDecision {
  kept: KeptPick[];
  dropped: DroppedPick[];
  note_to_mashmaker: string;
}

/**
 * Make the Machine's answer safe to store: only ids we sent, no duplicates, kept capped and
 * re-ordered 1..n for the reveal, and nobody silently lost (anyone unmentioned is dropped
 * with a neutral reason). Positions order a reveal; they never score a person.
 */
export function sanitiseBatch(
  raw: BatchDecision,
  candidateIds: readonly string[],
  maxKept: number,
): BatchDecision {
  const ids = new Set(candidateIds);
  const seen = new Set<string>();
  const kept = raw.kept
    .filter((k) => ids.has(k.candidate_id))
    .filter((k) => {
      if (seen.has(k.candidate_id)) return false;
      seen.add(k.candidate_id);
      return true;
    })
    .sort((a, b) => a.position - b.position)
    .slice(0, maxKept)
    .map((k, i) => ({ ...k, position: i + 1 }));
  const keptIds = new Set(kept.map((k) => k.candidate_id));

  const dropped: DroppedPick[] = [];
  const droppedIds = new Set<string>();
  for (const d of raw.dropped) {
    if (!ids.has(d.candidate_id) || keptIds.has(d.candidate_id) || droppedIds.has(d.candidate_id))
      continue;
    droppedIds.add(d.candidate_id);
    dropped.push(d);
  }
  for (const id of candidateIds) {
    if (!keptIds.has(id) && !droppedIds.has(id)) {
      droppedIds.add(id);
      dropped.push({ candidate_id: id, reason: 'Not a fit for this batch.' });
    }
  }
  return { kept, dropped, note_to_mashmaker: raw.note_to_mashmaker };
}

/** The Machine's nudge to a Mashmaker, or null when there is nothing worth saying. */
export function nudgeText(args: {
  catchFirstName: string;
  hasVouch: boolean;
  openBatch: boolean;
  batchesFromThisMashmaker: number;
  nominatable: number;
}): string | null {
  const { catchFirstName, hasVouch, openBatch, batchesFromThisMashmaker, nominatable } = args;
  if (!hasVouch) {
    return `${catchFirstName} asked you to be their Mashmaker. A line about them is the first thing a Catch will read.`;
  }
  if (openBatch) return null;
  if (batchesFromThisMashmaker === 0 && nominatable > 0) {
    return `You have ${nominatable === 1 ? 'one person' : `${nominatable} people`} in your circle who could be mashed with ${catchFirstName}. Want to put a batch together?`;
  }
  if (batchesFromThisMashmaker === 0 && nominatable === 0) {
    return `No one in your contacts right now for ${catchFirstName}. Invite a friend and the Machine will tell you when that changes.`;
  }
  return null;
}

/** Normalise a pair of user ids so (a, b) and (b, a) store as one connection row. */
export function orderedPair(a: string, b: string): { user_a: string; user_b: string } {
  return a < b ? { user_a: a, user_b: b } : { user_a: b, user_b: a };
}

export type OutcomeKind =
  'meeting' | 'met' | 'met_again' | 'no_show' | 'dating' | 'together' | 'ended' | 'not_for_me';

/** Which mash status an outcome report implies, or null for "no change". */
export function statusForOutcome(outcome: OutcomeKind): 'met' | 'closed' | null {
  if (
    outcome === 'met' ||
    outcome === 'met_again' ||
    outcome === 'dating' ||
    outcome === 'together'
  )
    return 'met';
  if (outcome === 'ended' || outcome === 'not_for_me') return 'closed';
  return null;
}

/** "met and went again" is the company's north metric. */
export function isNorthMetric(outcome: OutcomeKind): boolean {
  return outcome === 'met_again' || outcome === 'dating' || outcome === 'together';
}

/** What a Mashmaker is told about an outcome, given what the Catch chose to share. */
export function outcomeLineForMashmaker(
  share: 'nothing' | 'met' | 'details',
  outcome: OutcomeKind,
  catchFirstName: string,
  candidateFirstName: string,
): string | null {
  if (share === 'nothing') return null;
  if (share === 'met') return `${catchFirstName} and ${candidateFirstName} met.`;
  const words: Record<OutcomeKind, string> = {
    meeting: 'are meeting',
    met: 'met',
    met_again: 'met and are going again',
    no_show: 'did not end up meeting',
    dating: 'are seeing each other',
    together: 'are together',
    ended: 'have called it',
    not_for_me: 'met, and it was not a fit',
  };
  return `${catchFirstName} and ${candidateFirstName} ${words[outcome]}.`;
}

/**
 * Mashmaker rule 3: say why, about the two people. The safety agent screens a note for the
 * things that would embarrass the subject: their body, their money, their exes. Plain word
 * lists, on purpose. Returns the problems found, empty when the note is fine.
 */
export function noteProblems(text: string, minLength: number): string[] {
  const t = text.trim();
  const problems: string[] = [];
  if (t.length < minLength) problems.push(`Say a little more. ${minLength} characters at least.`);
  const lower = ` ${t.toLowerCase()} `;
  const groups: { words: string[]; why: string }[] = [
    {
      words: [
        'sexy',
        'hot body',
        'great body',
        'boobs',
        'bum',
        'skinny',
        'fat',
        'thin',
        'curvy',
        'ripped',
        'abs',
      ],
      why: 'Leave their body out of it.',
    },
    {
      words: [
        'rich',
        'loaded',
        'earns',
        'salary',
        'income',
        'minted',
        'wealthy',
        'owns a house',
        'his money',
        'her money',
      ],
      why: 'Leave their money out of it.',
    },
    {
      words: [
        ' ex ',
        ' ex-',
        'his ex',
        'her ex',
        'divorce',
        'dumped',
        'cheated',
        'broke up',
        'breakup',
      ],
      why: 'Leave their exes out of it.',
    },
    { words: ['trust me', 'just trust me'], why: '"Trust me" is not a note. Say why.' },
  ];
  for (const g of groups) {
    if (g.words.some((w) => lower.includes(w.startsWith(' ') ? w : ` ${w}`) || lower.includes(w)))
      problems.push(g.why);
  }
  return problems;
}

/** The line both sides see when a mash stops without a mutual yes. No reason, in any direction. */
export function didNotGoAhead(
  status: 'pending' | 'mutual' | 'declined' | 'met' | 'closed' | 'expired',
): string | null {
  if (status === 'declined' || status === 'closed') return 'This one didn’t go ahead.';
  if (status === 'expired') return 'This one timed out.';
  return null;
}
