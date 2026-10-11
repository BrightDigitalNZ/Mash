// Home. Your circle: the faces of the people vouching for you and what they wrote.
// Never empty by design. Before any match exists, this screen is the product.

import { router } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorView,
  FaceRow,
  Heading,
  Loading,
  Progress,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { useCircle, useIntros, useLineups } from '@/hooks/useData';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const UNLOCK_AT = 10;

function goInvite() {
  router.push('/invite');
}

export default function CircleScreen() {
  const me = useSession((s) => s.session?.user.id);
  const circle = useCircle();
  const lineups = useLineups();
  const intros = useIntros();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([circle.refetch(), lineups.refetch(), intros.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const rows = circle.data ?? [];
  const n = rows.length;
  const faces = rows.map((r) => ({ id: r.voucher_id, first_name: r.first_name, photo_url: r.photo_url }));

  // Someone's friend has put me forward. Their yes is waiting on mine.
  const waitingOnMe = (intros.data ?? []).filter(
    (i) => i.candidate_id === me && i.status === 'pending' && i.candidate_decision === 'undecided',
  );

  const myLineups = (lineups.data ?? []).filter(
    (l) => l.single_id === me && (l.status === 'ready' || l.status === 'done'),
  );

  let content: React.ReactNode;
  if (circle.isLoading) {
    content = <Loading />;
  } else if (circle.isError) {
    content = <ErrorView message="Your circle didn't load." onRetry={() => circle.refetch()} />;
  } else {
    content = (
      <Stack gap={spacing.xl}>
        {waitingOnMe.map((i) => (
          <Card key={i.id} tone="highlight" onPress={() => router.push(`/intro/${i.id}`)}>
            <Stack row gap={spacing.md} align="center">
              <Avatar uri={i.single.photo_url} name={i.single.first_name} size={44} />
              <View style={{ flex: 1 }}>
                <Body>
                  {names(i.vouchers.map((v) => v.first_name))} wants to introduce you to {i.single.first_name}
                </Body>
                <Caption>Open it when you have a minute.</Caption>
              </View>
            </Stack>
          </Card>
        ))}

        <Stack gap={spacing.md}>
          <Title>Your circle</Title>
          {n > 0 ? <FaceRow people={faces} size={44} max={7} /> : null}
          {n < UNLOCK_AT ? (
            <Stack gap={spacing.md}>
              <Progress value={n} max={UNLOCK_AT} />
              <Body>
                Your circle is {n}. Matches unlock at {UNLOCK_AT}.
              </Body>
              <Button title="Invite a friend to vouch" onPress={goInvite} />
            </Stack>
          ) : (
            <Caption>Your circle is {n}. Lineups arrive when a friend nominates.</Caption>
          )}
        </Stack>

        {myLineups.length > 0 ? (
          <Stack gap={spacing.md}>
            <Heading>Lineups</Heading>
            {myLineups.map((l) => (
              <Card key={l.id} onPress={() => router.push(`/lineup/${l.id}`)}>
                <Stack row align="center" justify="space-between">
                  <Stack row gap={spacing.md} align="center">
                    <Avatar uri={l.voucher.photo_url} name={l.voucher.first_name} size={40} />
                    <View>
                      <Body>{l.voucher.first_name}&rsquo;s lineup</Body>
                      <Caption>
                        {l.kept} {l.kept === 1 ? 'person' : 'people'}
                      </Caption>
                    </View>
                  </Stack>
                  <Caption color={l.status === 'ready' ? colors.accent : colors.textMuted}>
                    {l.status === 'ready' ? 'New' : 'Done'}
                  </Caption>
                </Stack>
              </Card>
            ))}
          </Stack>
        ) : null}

        {n === 0 ? (
          <Empty
            title="Nobody has vouched for you yet"
            body="Invite a friend who knows you well. Their words are the first thing anyone sees."
            action={{ title: 'Invite a friend', onPress: goInvite }}
          />
        ) : (
          <Stack gap={spacing.md}>
            {rows.map((r) => (
              <Card key={r.voucher_id}>
                <Stack row gap={spacing.md} align="center">
                  <Avatar uri={r.photo_url} name={r.first_name} size={40} />
                  <View style={{ flex: 1 }}>
                    <Body>{r.first_name}</Body>
                    {r.how_known ? <Caption>{r.how_known}</Caption> : null}
                  </View>
                </Stack>
                <Quote text={r.text} by={r.prompt} style={{ marginTop: spacing.sm }} />
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xxl,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {content}
      </ScrollView>
    </Screen>
  );
}

/** "Holly", "Holly and Kim", "Holly, Kim and Sam". */
function names(list: string[]): string {
  if (list.length === 0) return 'A friend';
  if (list.length === 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}
