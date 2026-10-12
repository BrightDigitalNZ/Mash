// "How did it go?" Light, and the Catch chooses each time what their Mashmakers learn.
// Nothing is the default. Earlier answers are shown as a line, never a score.

import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Card, Chip, Heading, Stack } from '@/components/ui';
import { keys } from '@/hooks/useData';
import { reportOutcome } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';
import type { Outcome, OutcomeKind, ShareLevel } from '@/types/database';

const outcomeWord: Record<OutcomeKind, string> = {
  meeting: 'Meeting',
  met: 'Met',
  met_again: copy.outcome.options.metAgain,
  no_show: 'Didn’t meet',
  dating: 'Seeing each other',
  together: 'Together',
  ended: 'Ended',
  not_for_me: copy.outcome.options.notForMe,
};

const shareWord: Record<ShareLevel, string> = {
  nothing: 'Your Mashmakers weren’t told.',
  met: 'Your Mashmakers know you met.',
  details: 'Your Mashmakers know how it went.',
};

const shareChips: { share: ShareLevel; label: string }[] = [
  { share: 'nothing', label: 'Nothing' },
  { share: 'met', label: 'That we met' },
  { share: 'details', label: 'How it went' },
];

export default function MashOutcomeCard({
  mashId,
  me,
  mashmakerNames,
  outcomes,
}: {
  mashId: string;
  me: string;
  mashmakerNames: string;
  outcomes: Outcome[];
}) {
  const qc = useQueryClient();
  const [hidden, setHidden] = useState(false);
  const [picked, setPicked] = useState<OutcomeKind | null>(null);
  const [share, setShare] = useState<ShareLevel>('nothing');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = outcomes.filter((o) => o.reported_by === me);

  async function save() {
    if (!picked || saving) return;
    setSaving(true);
    setError(null);
    try {
      await reportOutcome({ mashId, reportedBy: me, outcome: picked, share });
      setSaved(true);
      setPicked(null);
      setShare('nothing');
      qc.invalidateQueries({ queryKey: keys.outcomes(mashId) });
      qc.invalidateQueries({ queryKey: keys.mash(mashId) });
      qc.invalidateQueries({ queryKey: keys.mashes });
      qc.invalidateQueries({ queryKey: keys.record });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setSaving(false);
    }
  }

  const history =
    mine.length > 0 ? (
      <Stack gap={spacing.xs}>
        {mine.map((o) => (
          <Caption key={o.id}>
            You said: {outcomeWord[o.outcome]}. {shareWord[o.share]}
          </Caption>
        ))}
      </Stack>
    ) : null;

  if (hidden || saved) {
    return history ? <Card tone="alt">{history}</Card> : null;
  }

  return (
    <Card tone="alt">
      <Stack gap={spacing.md}>
        {history}
        {!picked ? (
          <Stack gap={spacing.sm}>
            <Heading>{copy.outcome.prompt}</Heading>
            <View testID="outcome-met-again">
              <Button
                title={copy.outcome.options.metAgain}
                variant="secondary"
                onPress={() => setPicked('met_again')}
              />
            </View>
            <View testID="outcome-not-for-me">
              <Button
                title={copy.outcome.options.notForMe}
                variant="secondary"
                onPress={() => setPicked('not_for_me')}
              />
            </View>
            <Button
              title={copy.outcome.options.skip}
              variant="ghost"
              onPress={() => setHidden(true)}
            />
          </Stack>
        ) : (
          <Stack gap={spacing.sm}>
            <Caption>{outcomeWord[picked]}</Caption>
            <Body>{copy.outcome.shareAsk(mashmakerNames)}</Body>
            <Stack row wrap gap={spacing.sm}>
              {shareChips.map((c) => (
                <Chip
                  key={c.share}
                  label={c.label}
                  selected={share === c.share}
                  onPress={() => setShare(c.share)}
                />
              ))}
            </Stack>
            <View testID="outcome-save">
              <Button title="Save" onPress={save} loading={saving} />
            </View>
            <Button
              title="Back"
              variant="ghost"
              onPress={() => setPicked(null)}
              disabled={saving}
            />
            {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
