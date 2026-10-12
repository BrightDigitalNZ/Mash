import {
  noteProblems,
  didNotGoAhead,
  isNorthMetric,
  nudgeText,
  orderedPair,
  outcomeLineForMashmaker,
  sanitiseBatch,
  statusForOutcome,
} from '../rules';

describe('sanitiseBatch', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('keeps only ids we sent, dedupes, caps and re-orders', () => {
    const out = sanitiseBatch(
      {
        kept: [
          { candidate_id: 'c', position: 2, reason: 'r2' },
          { candidate_id: 'a', position: 1, reason: 'r1' },
          { candidate_id: 'a', position: 5, reason: 'dup' },
          { candidate_id: 'zzz', position: 0, reason: 'not ours' },
          { candidate_id: 'd', position: 3, reason: 'r3' },
        ],
        dropped: [{ candidate_id: 'b', reason: 'in Perth' }],
        note_to_mashmaker: 'Good picks.',
      },
      ids,
      2,
    );
    expect(out.kept.map((k) => k.candidate_id)).toEqual(['a', 'c']);
    expect(out.kept.map((k) => k.position)).toEqual([1, 2]);
    expect(out.dropped.map((d) => d.candidate_id).sort()).toEqual(['b', 'd']);
    expect(out.note_to_mashmaker).toBe('Good picks.');
  });

  it('never loses a candidate the Machine forgot to mention', () => {
    const out = sanitiseBatch({ kept: [], dropped: [], note_to_mashmaker: '' }, ids, 5);
    expect(out.kept).toEqual([]);
    expect(out.dropped).toHaveLength(4);
  });

  it('does not list a kept person as dropped', () => {
    const out = sanitiseBatch(
      {
        kept: [{ candidate_id: 'a', position: 1, reason: 'yes' }],
        dropped: [{ candidate_id: 'a', reason: 'x' }],
        note_to_mashmaker: '',
      },
      ['a'],
      5,
    );
    expect(out.kept).toHaveLength(1);
    expect(out.dropped).toHaveLength(0);
  });
});

describe('nudgeText', () => {
  const base = {
    catchFirstName: 'Tin',
    hasVouch: true,
    openBatch: false,
    batchesFromThisMashmaker: 0,
    nominatable: 0,
  };

  it('asks for the line first', () => {
    expect(nudgeText({ ...base, hasVouch: false })).toContain('asked you to be their Mashmaker');
  });

  it('never nags while a batch is open', () => {
    expect(nudgeText({ ...base, openBatch: true, nominatable: 4 })).toBeNull();
  });

  it('suggests a batch when there are people', () => {
    expect(nudgeText({ ...base, nominatable: 2 })).toBe(
      'You have 2 people in your circle who could be mashed with Tin. Want to put a batch together?',
    );
  });

  it('says so when there is no one', () => {
    expect(nudgeText(base)).toContain('No one in your contacts right now');
  });

  it('is quiet once a batch has been sent', () => {
    expect(nudgeText({ ...base, batchesFromThisMashmaker: 1, nominatable: 3 })).toBeNull();
  });
});

describe('orderedPair', () => {
  it('is symmetric', () => {
    expect(orderedPair('b', 'a')).toEqual({ user_a: 'a', user_b: 'b' });
    expect(orderedPair('a', 'b')).toEqual({ user_a: 'a', user_b: 'b' });
  });
});

describe('outcomes', () => {
  it('maps outcomes to mash status', () => {
    expect(statusForOutcome('met_again')).toBe('met');
    expect(statusForOutcome('together')).toBe('met');
    expect(statusForOutcome('ended')).toBe('closed');
    expect(statusForOutcome('meeting')).toBeNull();
  });

  it('knows the north metric', () => {
    expect(isNorthMetric('met_again')).toBe(true);
    expect(isNorthMetric('met')).toBe(false);
  });

  it('tells the Mashmaker only what was shared', () => {
    expect(outcomeLineForMashmaker('nothing', 'together', 'Tin', 'Ben')).toBeNull();
    expect(outcomeLineForMashmaker('met', 'together', 'Tin', 'Ben')).toBe('Tin and Ben met.');
    expect(outcomeLineForMashmaker('details', 'met_again', 'Tin', 'Ben')).toBe(
      'Tin and Ben met and are going again.',
    );
  });
});

describe('noteProblems (Mashmaker rule 3)', () => {
  it('passes a note about the two people', () => {
    expect(noteProblems('You both hate small talk and both ran the half this year.', 20)).toEqual(
      [],
    );
  });
  it('asks for more when the note is too short', () => {
    expect(noteProblems('Nice guy', 20)).toHaveLength(1);
  });
  it('flags body, money and exes', () => {
    expect(noteProblems('She has a great body and is loaded since her divorce', 20)).toHaveLength(
      3,
    );
  });
  it('rejects "trust me" as a note', () => {
    expect(noteProblems('Honestly just trust me on this one, he is great', 20)).toContain(
      '"Trust me" is not a note. Say why.',
    );
  });
});

describe('didNotGoAhead', () => {
  it('says the true thing plainly, with no reason', () => {
    expect(didNotGoAhead('declined')).toBe('This one didn’t go ahead.');
    expect(didNotGoAhead('expired')).toBe('This one timed out.');
    expect(didNotGoAhead('mutual')).toBeNull();
  });
});
