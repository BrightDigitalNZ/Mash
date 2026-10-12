// The Machine's checks, requested by one person and shown only to them. Gated by the
// dd_requires_plus switch and the requester's entitlement. Mashmakers never see this.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import BriefCard from '@/components/BriefCard';
import { Body, Button, Caption, Card, Heading, Loading, Stack } from '@/components/ui';
import { keys } from '@/hooks/useData';
import { requestBrief } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';
import type { Brief } from '@/types/database';

export default function MashChecksCard({
  mashId,
  otherName,
  brief,
  loading,
  needsPlus,
}: {
  mashId: string;
  otherName: string;
  brief: Brief | null;
  loading: boolean;
  /** dd_requires_plus is on and this person is not entitled */
  needsPlus: boolean;
}) {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (running) return;
    setRunning(true);
    setError(null);
    try {
      await requestBrief(mashId);
      await qc.invalidateQueries({ queryKey: keys.brief(mashId) });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : copy.errors.didNotSave);
    } finally {
      setRunning(false);
    }
  }

  if (brief) return <BriefCard content={brief.content} subjectName={otherName} />;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <Heading>Want the Machine to check them out first?</Heading>
        {loading ? <Loading /> : null}
        {!loading && needsPlus ? (
          <Stack gap={spacing.sm}>
            <Body>{copy.plus.pitch}</Body>
            <View testID="see-plus">
              <Button
                title="See Mash Plus"
                variant="secondary"
                full={false}
                onPress={() => router.push('/settings/plus')}
              />
            </View>
          </Stack>
        ) : null}
        {!loading && !needsPlus ? (
          <View testID="run-checks">
            <Button
              title="Run the checks"
              variant="secondary"
              full={false}
              onPress={run}
              loading={running}
            />
          </View>
        ) : null}
        {running ? <Caption>The Machine is reading what {otherName} linked.</Caption> : null}
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        <Caption>{copy.plus.what}</Caption>
      </Stack>
    </Card>
  );
}
