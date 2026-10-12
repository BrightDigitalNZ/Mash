// A Mashmaker wants to show you to someone. You are asked first, every time, and no is final.

import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { CatchCheckLine } from '@/components/CatchCheckLine';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorView,
  Heading,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useConsentRequests } from '@/hooks/useData';
import { answerConsent } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(catch)/mashmakers');
}

export default function ConsentScreen() {
  const { batchId } = useLocalSearchParams<{ batchId: string }>();
  const profile = useSession((s) => s.profile);
  const qc = useQueryClient();
  const requests = useConsentRequests();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const req = (requests.data ?? []).find((r) => r.batch_id === batchId) ?? null;

  async function answer(consent: 'yes' | 'no') {
    if (!req || busy) return;
    setBusy(consent);
    setError(null);
    try {
      await answerConsent(req.entry_id, consent);
      await qc.invalidateQueries({ queryKey: keys.consents });
      qc.invalidateQueries({ queryKey: keys.batches });
      leave();
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setBusy(null);
    }
  }

  if (requests.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  if (requests.isError) {
    return (
      <Screen>
        <ErrorView message={copy.errors.didNotLoad} onRetry={() => requests.refetch()} />
      </Screen>
    );
  }
  if (!req) {
    return (
      <Screen>
        <Empty
          title="Nothing to answer here."
          body="You may have answered already."
          action={{ title: 'Done', onPress: leave }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack row gap={spacing.md} align="center">
          <Avatar uri={req.mashmaker.photo_url} name={req.mashmaker.first_name} size={56} />
          <View style={{ flex: 1 }}>
            <Caption>Your Mashmaker</Caption>
            <Heading>{req.mashmaker.first_name}</Heading>
          </View>
        </Stack>

        <Stack gap={spacing.sm}>
          <Title>{copy.consent.ask(req.mashmaker.first_name, req.catch_first_name)}</Title>
          <Body color={colors.textSecondary}>{copy.consent.explain}</Body>
        </Stack>

        <Stack gap={spacing.sm}>
          <Caption>What {req.catch_first_name} would see</Caption>
          <Card tone="alt">
            <Stack row gap={spacing.md} align="center">
              <Avatar uri={profile?.photo_url} name={profile?.first_name} size={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Heading>{profile?.first_name ?? 'You'}</Heading>
                {profile?.city ? <Caption>{profile.city}</Caption> : null}
              </View>
            </Stack>
            {profile?.bio ? <Body color={colors.textSecondary}>{profile.bio}</Body> : null}
            <Stack gap={spacing.xs} style={{ marginTop: spacing.xs }}>
              <CatchCheckLine label="Identity verified" done={!!profile?.verified_identity} />
              <CatchCheckLine label="Photos checked current" done={!!profile?.photos_current} />
            </Stack>
            <Caption>And {req.mashmaker.first_name}’s note about you. Nothing else.</Caption>
          </Card>
        </Stack>

        <Stack gap={spacing.sm}>
          <Stack row gap={spacing.sm}>
            <View style={{ flex: 1 }} testID="consent-yes">
              <Button
                title="Yes"
                variant="accent"
                accessibilityLabel={`Yes, ${req.mashmaker.first_name} can show me to ${req.catch_first_name}`}
                onPress={() => answer('yes')}
                loading={busy === 'yes'}
                disabled={!!busy}
              />
            </View>
            <View style={{ flex: 1 }} testID="consent-no">
              <Button
                title="No"
                variant="secondary"
                accessibilityLabel={`No, do not show me to ${req.catch_first_name}`}
                onPress={() => answer('no')}
                loading={busy === 'no'}
                disabled={!!busy}
              />
            </View>
          </Stack>
          <Button title="Decide later" variant="ghost" onPress={leave} disabled={!!busy} />
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        </Stack>
      </Stack>
    </Screen>
  );
}
