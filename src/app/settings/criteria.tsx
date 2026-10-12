// What a Catch is after, and the separate yes to being matched at all.

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import CriteriaForm from '@/components/CriteriaForm';
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  ErrorView,
  Heading,
  Loading,
  Screen,
  Stack,
} from '@/components/ui';
import { keys, useCriteria } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { Criteria } from '@/types/database';

export default function CriteriaScreen() {
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const qc = useQueryClient();
  const criteria = useCriteria(me);

  const [saved, setSaved] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const matching = !!profile?.open_to_matching;

  const onSaved = (next: Criteria) => {
    if (!me) return;
    qc.setQueryData(keys.criteria(me), next);
    qc.invalidateQueries({ queryKey: keys.criteria(me) });
    setSaved(true);
  };

  const setMatching = async (open: boolean) => {
    if (switching || open === matching) return;
    setSwitching(true);
    setSwitchError(null);
    try {
      await updateProfile({ open_to_matching: open });
      if (open) track(Events.matchingOptedIn);
    } catch {
      setSwitchError(copy.errors.didNotSave);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Card tone="alt">
          <Heading>{matching ? 'You’re being matched.' : 'You’re not being matched.'}</Heading>
          <Body color={colors.textSecondary}>{copy.onboarding.optIn}</Body>
          <Stack row gap={spacing.sm}>
            <Button
              title="Match me"
              variant={matching ? 'ghost' : 'primary'}
              full={false}
              small
              onPress={() => setMatching(true)}
              disabled={switching || matching}
            />
            <Button
              title="Stop matching me"
              variant={matching ? 'secondary' : 'ghost'}
              full={false}
              small
              onPress={() => setMatching(false)}
              disabled={switching || !matching}
            />
          </Stack>
          {switchError ? <Caption color={colors.danger}>{switchError}</Caption> : null}
        </Card>

        <Divider />

        {criteria.isLoading || !me ? (
          <Loading />
        ) : criteria.error ? (
          <ErrorView message={copy.errors.didNotLoad} onRetry={() => criteria.refetch()} />
        ) : (
          <Stack gap={spacing.md}>
            <CriteriaForm catchId={me} initial={criteria.data ?? null} onSaved={onSaved} />
            {saved ? <Caption>Saved.</Caption> : null}
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}
