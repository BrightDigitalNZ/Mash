import { nudgeText, orderedPair, sanitiseLineup, statusForOutcome } from '../rules';

describe('sanitiseLineup', () => {
  const ids = ['a', 'b', 'c', 'd'];

  it('keeps only ids we sent, dedupes, caps and re-ranks', () => {
    const out = sanitiseLineup(
      {
        kept: [
          { candidate_id: 'c', rank: 2, reason: 'r2' },
          { candidate_id: 'a', rank: 1, reason: 'r1' },
          { candidate_id: 'a', rank: 5, reason: 'dup' },
          { candidate_id: 'zzz', rank: 0, reason: 'not ours' },
          { candidate_id: 'd', rank: 3, reason: 'r3' },
        ],
        dropped: [{ candidate_id: 'b', reason: 'in Perth' }],
        note_to_voucher: 'Good picks.',
      },
      ids,
      2,
    );
    expect(out.kept.map((k) => k.candidate_id)).toEqual(['a', 'c']);
    expect(out.kept.map((k) => k.rank)).toEqual([1, 2]);
    // d overflowed the cap and must land in dropped, not vanish
    expect(out.dropped.map((d) => d.candidate_id).sort()).toEqual(['b', 'd']);
    expect(out.note_to_voucher).toBe('Good picks.');
  });

  it('never loses a candidate the model forgot to mention', () => {
    const out = sanitiseLineup({ kept: [], dropped: [], note_to_voucher: '' }, ids, 7);
    expect(out.kept).toEqual([]);
    expect(out.dropped).toHaveLength(4);
    expect(out.dropped.every((d) => d.reason.length > 0)).toBe(true);
  });

  it('does not list a kept person as dropped', () => {
    const out = sanitiseLineup(
      {
        kept: [{ candidate_id: 'a', rank: 1, reason: 'yes' }],
        dropped: [{ candidate_id: 'a', reason: 'contradiction' }],
        note_to_voucher: '',
      },
      ['a'],
      7,
    );
    expect(out.kept).toHaveLength(1);
    expect(out.dropped).toHaveLength(0);
  });
});

describe('nudgeText', () => {
  const base = {
    singleFirstName: 'Tin',
    circleSize: 10,
    unlockAt: 10,
    lineupsFromThisVoucher: 0,
    lineupsFromOthers: 0,
    nominatable: 0,
  };

  it('shows the honest circle state before unlock', () => {
    expect(nudgeText({ ...base, circleSize: 3 })).toBe(
      "Tin's circle is 3. Matches unlock at 10. Know 7 more people who would vouch for them?",
    );
    expect(nudgeText({ ...base, circleSize: 9 })).toContain('one more person');
  });

  it('asks for a lineup when the voucher has nominatable friends', () => {
    expect(nudgeText({ ...base, nominatable: 2 })).toBe(
      'You have 2 friends who could be on a lineup for Tin. Want to put one together?',
    );
  });

  it('mentions other vouchers only when this one has done nothing', () => {
    expect(nudgeText({ ...base, lineupsFromOthers: 1 })).toBe(
      "Tin's had one lineup from others. Yours is still to come.",
    );
    expect(nudgeText({ ...base, lineupsFromThisVoucher: 1, lineupsFromOthers: 3 })).toBeNull();
  });

  it('says nothing when there is nothing to say', () => {
    expect(nudgeText(base)).toBeNull();
  });
});

describe('orderedPair', () => {
  it('is symmetric', () => {
    expect(orderedPair('b', 'a')).toEqual({ user_a: 'a', user_b: 'b' });
    expect(orderedPair('a', 'b')).toEqual({ user_a: 'a', user_b: 'b' });
  });
});

describe('statusForOutcome', () => {
  it('maps outcomes to intro status', () => {
    expect(statusForOutcome('met')).toBe('met');
    expect(statusForOutcome('together')).toBe('met');
    expect(statusForOutcome('ended')).toBe('closed');
    expect(statusForOutcome('meeting')).toBeNull();
  });
});
