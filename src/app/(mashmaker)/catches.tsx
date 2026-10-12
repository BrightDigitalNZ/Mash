// The Mashmaker's home. Who has asked, who said yes, and what to do next for each of them.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import MashmakerCatchCard from '@/components/MashmakerCatchCard';
import { Avatar, Body, Button, Caption, Card, Empty, ErrorView, Label, ListRow, Loading, Screen, Stack, Title } from '@/components/ui';
import { keys, useBatches, useConnections, useMyCatches, useNotifications } from '@/hooks/useData';
import { answerMashmakerRequest, markNotificationsRead, offerToMashmake } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { MyCatchRow, Notification } from '@/types/database';

function NudgeCard({ n, onRead }: { n: Notification; onRead: () => void }) {
  const route = typeof n.data?.route === 'string' ? n.data.route : null;
  return (
    <Card
      tone="highlight"
      accessibilityLabel={n.body}
      onPress={() => {
        onRead();
        if (route) router.push(route as never);
      }}
    >
      <Caption color={colors.textSecondary}>{n.body}</Caption>
    </Card>
  );
}

function RequestCard({ row, onAnswer }: { row: MyCatchRow; onAnswer: (accept: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answer = async (accept: boolean) => {
    setBusy(accept ? 'yes' : 'no');
    setError(null);
    try {
      await onAnswer(accept);
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card tone="alt">
      <Stack row align="center" gap={spacing.md}>
        <Avatar uri={row.photo_url} name={row.first_name} size={48} />
        <View style={{ flex: 1 }}>
          <Body>{row.first_name} asked you to be their Mashmaker.</Body>
          {row.city ? <Caption>{row.city}</Caption> : null}
        </View>
      </Stack>
      <Stack row gap={spacing.sm}>
        <View style={{ flex: 1 }} testID="accept-catch">
          <Button title="Yes" onPress={() => answer(true)} loading={busy === 'yes'} disabled={busy === 'no'} accessibilityLabel={`Yes, be ${row.first_name}’s Mashmaker`} />
        </View>
        <View style={{ flex: 1 }} testID="decline-catch">
          <Button title="No" variant="secondary" onPress={() => answer(false)} loading={busy === 'no'} disabled={busy === 'yes'} accessibilityLabel={`No, not for ${row.first_name}`} />
        </View>
      </Stack>
      <Caption>They’ll know you said yes. If you say no, they just won’t see you here.</Caption>
      {error ? <Caption color={colors.danger}>{error}</Caption> : null}
    </Card>
  );
}

function OfferRow({ person, onOffer }: { person: { id: string; first_name: string; photo_url: string | null; city: string | null }; onOffer: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offer = async () => {
    setBusy(true);
    setError(null);
    try {
      await onOffer();
      setDone(true);
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setBusy(false);
    }
  };
  return (
    <ListRow
      title={person.first_name}
      subtitle={error ?? person.city ?? undefined}
      left={<Avatar uri={person.photo_url} name={person.first_name} size={44} />}
      right={
        done ? (
          <Caption>Offered</Caption>
        ) : (
          <Button title="Offer" small full={false} variant="secondary" onPress={offer} loading={busy} accessibilityLabel={`Offer to be ${person.first_name}’s Mashmaker`} />
        )
      }
    />
  );
}

export default function Catches() {
  const me = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const catches = useMyCatches();
  const connections = useConnections();
  const batches = useBatches();
  const notifications = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [showOffer, setShowOffer] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([catches.refetch(), connections.refetch(), batches.refetch(), notifications.refetch()]);
    setRefreshing(false);
  }, [catches, connections, batches, notifications]);

  const invalidateLinks = () => {
    qc.invalidateQueries({ queryKey: keys.catches });
    qc.invalidateQueries({ queryKey: keys.connections });
    qc.invalidateQueries({ queryKey: keys.notifications });
  };

  const goInvite = () => router.push('/invite');

  const nudges = (notifications.data ?? []).filter((n) => n.kind === 'nudge' && !n.read);
  const readNudge = (id: string) => {
    markNotificationsRead([id])
      .catch(() => {})
      .finally(() => qc.invalidateQueries({ queryKey: keys.notifications }));
  };

  let content: ReactNode;

  if (catches.isLoading) {
    content = <Loading />;
  } else if (catches.error) {
    content = <ErrorView message={copy.errors.didNotLoad} onRetry={() => catches.refetch()} />;
  } else {
    const rows = catches.data ?? [];
    const requests = rows.filter((r) => r.status === 'requested' && r.requested_by === r.catch_id);
    const offered = rows.filter((r) => r.status === 'requested' && r.requested_by === me);
    const accepted = rows.filter((r) => r.status === 'accepted');
    const known = new Set(rows.map((r) => r.catch_id));
    const couldOffer = (connections.data ?? []).filter((c) => c.role === 'catch' && !known.has(c.id));
    const myBatches = (batches.data ?? []).filter((b) => b.mashmaker.id === me);

    content = (
      <Stack gap={spacing.xl}>
        {nudges.length > 0 ? (
          <Stack gap={spacing.sm}>
            {nudges.map((n) => (
              <NudgeCard key={n.id} n={n} onRead={() => readNudge(n.id)} />
            ))}
          </Stack>
        ) : null}

        {requests.length > 0 ? (
          <Stack gap={spacing.md}>
            {requests.map((r) => (
              <RequestCard
                key={r.link_id}
                row={r}
                onAnswer={async (accept) => {
                  await answerMashmakerRequest(r.link_id, accept);
                  invalidateLinks();
                }}
              />
            ))}
          </Stack>
        ) : null}

        {accepted.length === 0 && requests.length === 0 ? <Empty title="Nobody yet" body={copy.empty.catches} /> : null}

        {accepted.length > 0 ? (
          <Stack gap={spacing.md}>
            {accepted.map((r) => (
              <MashmakerCatchCard key={r.link_id} row={r} batches={myBatches.filter((b) => b.catch.id === r.catch_id)} />
            ))}
          </Stack>
        ) : null}

        {offered.length > 0 ? (
          <Stack gap={0}>
            <Label>Waiting on them</Label>
            {offered.map((r) => (
              <ListRow
                key={r.link_id}
                title={r.first_name}
                subtitle={r.city ?? undefined}
                left={<Avatar uri={r.photo_url} name={r.first_name} size={44} />}
                right={<Caption>Offered</Caption>}
              />
            ))}
          </Stack>
        ) : null}

        <Stack gap={spacing.sm}>
          <Button title="Invite a friend" variant="ghost" onPress={goInvite} />
          {couldOffer.length > 0 ? (
            <Stack gap={0}>
              <Button
                title={showOffer ? 'Not now' : 'Offer to be someone’s Mashmaker'}
                variant="ghost"
                accessibilityLabel={showOffer ? 'Hide the people you could offer to' : 'Offer to be someone’s Mashmaker'}
                onPress={() => setShowOffer((v) => !v)}
              />
              {showOffer ? (
                <Stack gap={0}>
                  <Caption>People in your contacts who are Catches. They still have to say yes.</Caption>
                  {couldOffer.map((c) => (
                    <OfferRow
                      key={c.id}
                      person={c}
                      onOffer={async () => {
                        if (!me) return;
                        await offerToMashmake(me, c.id);
                        invalidateLinks();
                      }}
                    />
                  ))}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Stack>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Title style={{ marginBottom: spacing.lg }}>Your Catches</Title>
        {content}
      </ScrollView>
    </Screen>
  );
}
