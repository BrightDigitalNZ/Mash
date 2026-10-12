// Catch home. The friends vouching for you, what is waiting on you, and what has arrived.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  ErrorView,
  Heading,
  ListRow,
  Loading,
  Quote,
  Screen,
  Stack,
  Text,
  Title,
} from '@/components/ui';
import {
  keys,
  trialDaysLeft,
  useBatches,
  useConsentRequests,
  useMyMashmakers,
  type ConsentRequest,
} from '@/hooks/useData';
import { answerConsent, answerMashmakerRequest } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { MyMashmakerRow } from '@/types/database';

// --- a nominee's yes in principle, before the Catch sees them ----------------

function ConsentCard({ req }: { req: ConsentRequest }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(consent: 'yes' | 'no') {
    if (busy) return;
    setBusy(consent);
    setError(null);
    try {
      await answerConsent(req.entry_id, consent);
      await qc.invalidateQueries({ queryKey: keys.consents });
      qc.invalidateQueries({ queryKey: keys.batches });
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ backgroundColor: colors.accent, gap: spacing.md }}>
      <Stack row gap={spacing.md} align="center">
        <Avatar uri={req.mashmaker.photo_url} name={req.mashmaker.first_name} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="quote" color={colors.textInverse}>
            {copy.consent.ask(req.mashmaker.first_name, req.catch_first_name)}
          </Text>
        </View>
      </Stack>
      <Caption color={colors.textInverse} style={{ opacity: 0.85 }}>
        {copy.consent.explain}
      </Caption>
      <Stack row gap={spacing.sm}>
        <View style={{ flex: 1 }} testID="consent-yes">
          <Button
            title="Yes"
            variant="inverse"
            accessibilityLabel={`Yes, ${req.mashmaker.first_name} can show me to ${req.catch_first_name}`}
            onPress={() => answer('yes')}
            loading={busy === 'yes'}
            disabled={!!busy}
          />
        </View>
        <View style={{ flex: 1 }} testID="consent-no">
          <Button
            title="No"
            variant="inverse"
            accessibilityLabel={`No, do not show me to ${req.catch_first_name}`}
            onPress={() => answer('no')}
            loading={busy === 'no'}
            disabled={!!busy}
          />
        </View>
      </Stack>
      {error ? <Caption color={colors.textInverse}>{error}</Caption> : null}
    </Card>
  );
}

// --- a Mashmaker offering. The Catch still has to say yes. ------------------

function OfferCard({ row }: { row: MyMashmakerRow }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    if (busy) return;
    setBusy(accept ? 'yes' : 'no');
    setError(null);
    try {
      await answerMashmakerRequest(row.link_id, accept);
      await qc.invalidateQueries({ queryKey: keys.mashmakers });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card tone="highlight" style={{ gap: spacing.md }}>
      <Stack row gap={spacing.md} align="center">
        <Avatar uri={row.photo_url} name={row.first_name} size={44} />
        <View style={{ flex: 1 }}>
          <Body>{row.first_name} offered to be your Mashmaker</Body>
        </View>
      </Stack>
      <Stack row gap={spacing.sm}>
        <View style={{ flex: 1 }}>
          <Button
            title="Accept"
            onPress={() => answer(true)}
            loading={busy === 'yes'}
            disabled={!!busy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Not now"
            variant="secondary"
            onPress={() => answer(false)}
            loading={busy === 'no'}
            disabled={!!busy}
          />
        </View>
      </Stack>
      {error ? <Caption color={colors.danger}>{error}</Caption> : null}
    </Card>
  );
}

// --- one Mashmaker and their note -------------------------------------------

function MashmakerCard({ row }: { row: MyMashmakerRow }) {
  const asked = row.status === 'requested';
  return (
    <Card>
      <Stack row gap={spacing.md} align="center">
        <Avatar uri={row.photo_url} name={row.first_name} size={44} />
        <View style={{ flex: 1 }}>
          <Body>{row.first_name}</Body>
          {asked ? <Caption>Asked</Caption> : row.text ? null : <Caption>No note yet</Caption>}
        </View>
      </Stack>
      {!asked && row.text ? (
        <Stack gap={spacing.xs} style={{ marginTop: spacing.xs }}>
          {row.prompt ? <Caption>{row.prompt}</Caption> : null}
          <Quote text={row.text} by={row.how_known ?? undefined} />
        </Stack>
      ) : null}
    </Card>
  );
}

// --- the screen -------------------------------------------------------------

export default function MashmakersScreen() {
  const profile = useSession((s) => s.profile);
  const me = useSession((s) => s.session?.user.id);
  const mashmakers = useMyMashmakers();
  const batches = useBatches();
  const consents = useConsentRequests();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([mashmakers.refetch(), batches.refetch(), consents.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const rows = mashmakers.data ?? [];
  const offers = rows.filter((r) => r.status === 'requested' && r.requested_by !== me);
  const mine = rows.filter(
    (r) => r.status === 'accepted' || (r.status === 'requested' && r.requested_by === me),
  );
  const myBatches = (batches.data ?? []).filter((b) => b.catch.id === me);
  const ready = myBatches.filter((b) => b.status === 'ready');
  const done = myBatches.filter((b) => b.status === 'done');
  const asks = consents.data ?? [];
  const days = trialDaysLeft(profile);

  let trialLine: string | null = null;
  if (profile && !profile.is_plus) {
    if (days == null) trialLine = copy.plus.trialStartsAtFirstBatch;
    else if (days === 0) trialLine = 'Your free 21 days are up.';
    else trialLine = copy.plus.trial(days);
  }

  let content: React.ReactNode;
  if (mashmakers.isLoading) {
    content = <Loading />;
  } else if (mashmakers.isError) {
    content = <ErrorView message={copy.errors.didNotLoad} onRetry={() => mashmakers.refetch()} />;
  } else {
    content = (
      <Stack gap={spacing.xl}>
        {asks.map((req) => (
          <ConsentCard key={req.entry_id} req={req} />
        ))}

        {ready.length > 0 || done.length > 0 ? (
          <Stack gap={spacing.md}>
            <Heading>Batches</Heading>
            {ready.map((b) => (
              <Card
                key={b.id}
                tone="highlight"
                onPress={() => router.push(`/batch/${b.id}`)}
                testID="open-batch"
                accessibilityLabel={`Open ${b.mashmaker.first_name}’s batch`}
              >
                <Stack row gap={spacing.md} align="center">
                  <Avatar uri={b.mashmaker.photo_url} name={b.mashmaker.first_name} size={44} />
                  <View style={{ flex: 1 }}>
                    <Body>{copy.batch.arrival(b.mashmaker.first_name, b.consented)}</Body>
                  </View>
                </Stack>
              </Card>
            ))}
            {done.map((b) => (
              <ListRow
                key={b.id}
                title={`Batch from ${b.mashmaker.first_name}`}
                left={
                  <Avatar uri={b.mashmaker.photo_url} name={b.mashmaker.first_name} size={36} />
                }
                right={<Caption>Done</Caption>}
                onPress={() => router.push(`/batch/${b.id}`)}
                style={{ paddingVertical: spacing.sm }}
              />
            ))}
          </Stack>
        ) : null}

        {offers.map((row) => (
          <OfferCard key={row.link_id} row={row} />
        ))}

        <Stack gap={spacing.md}>
          <Heading>Your Mashmakers</Heading>
          {mine.length === 0 ? (
            <Body color={colors.textSecondary}>{copy.empty.mashmakers}</Body>
          ) : (
            mine.map((row) => <MashmakerCard key={row.link_id} row={row} />)
          )}
          <Button
            title="Add a Mashmaker"
            variant="secondary"
            onPress={() => router.push('/(onboarding)/ask')}
          />
        </Stack>

        {trialLine ? (
          <Pressable
            onPress={() => router.push('/settings/plus')}
            accessibilityRole="button"
            accessibilityLabel="Mash Plus"
            style={({ pressed }) => [{ paddingVertical: spacing.xs }, pressed && { opacity: 0.7 }]}
          >
            <Caption>{trialLine}</Caption>
          </Pressable>
        ) : null}

        {profile && !profile.open_to_matching ? (
          <Card tone="alt">
            <Body>You’re on Mash but not being matched yet.</Body>
            <Caption>{copy.onboarding.optIn}</Caption>
            <Button
              title="Match me"
              full={false}
              onPress={() => router.push('/(onboarding)/criteria')}
              style={{ marginTop: spacing.xs }}
            />
          </Card>
        ) : null}
      </Stack>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
      }
    >
      <Stack gap={spacing.xl}>
        <Title>Hello, {profile?.first_name ?? 'there'}</Title>
        {content}
      </Stack>
    </Screen>
  );
}
