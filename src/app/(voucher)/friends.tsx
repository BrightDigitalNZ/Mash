import { router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorView,
  Heading,
  Label,
  ListRow,
  Loading,
  Progress,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { useConnections, useLineups, useMySingles } from '@/hooks/useData';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const CIRCLE_TARGET = 10;

const lineupStatusLabel = {
  building: 'Being built',
  ready: 'Ready for them',
  done: 'Finished',
} as const;

export default function Friends() {
  const me = useSession((s) => s.session?.user.id);
  const singles = useMySingles();
  const connections = useConnections();
  const lineups = useLineups();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([singles.refetch(), connections.refetch(), lineups.refetch()]);
    setRefreshing(false);
  }, [singles, connections, lineups]);

  const goInvite = () => router.push('/invite');

  let content: ReactNode;

  if (singles.isLoading || connections.isLoading) {
    content = <Loading />;
  } else if (singles.error) {
    content = (
      <ErrorView message="Could not load your singles." onRetry={() => singles.refetch()} />
    );
  } else {
    const mySingles = singles.data ?? [];
    const vouchedIds = new Set(mySingles.map((s) => s.single_id));
    const couldVouch = (connections.data ?? []).filter(
      (c) => c.role === 'single' && !vouchedIds.has(c.id),
    );
    const watching = (lineups.data ?? []).filter((l) => l.voucher_id === me);

    if (mySingles.length === 0 && couldVouch.length === 0) {
      content = (
        <Empty
          title="Nobody to vouch for yet"
          body="Invite a single friend. When they join from your invite, you'll be connected."
          action={{ title: 'Invite a friend', onPress: goInvite }}
        />
      );
    } else {
      content = (
        <Stack gap={spacing.xl}>
          {mySingles.length > 0 ? (
            <Stack gap={spacing.md}>
              {mySingles.map((s) => {
                const ready = s.circle_size >= CIRCLE_TARGET;
                return (
                  <Card key={s.single_id}>
                    <Stack row align="center" gap={spacing.md}>
                      <Avatar uri={s.photo_url} name={s.first_name} size={56} />
                      <View style={{ flex: 1 }}>
                        <Heading>{s.first_name}</Heading>
                        {s.city ? <Caption>{s.city}</Caption> : null}
                      </View>
                    </Stack>
                    {ready ? (
                      <Caption>Circle of {s.circle_size}. Ready for a lineup.</Caption>
                    ) : (
                      <Stack gap={spacing.xs}>
                        <Progress value={s.circle_size} max={CIRCLE_TARGET} />
                        <Caption>
                          Circle of {s.circle_size}. Lineups unlock at {CIRCLE_TARGET}.
                        </Caption>
                      </Stack>
                    )}
                    <Stack gap={spacing.sm} style={{ marginTop: spacing.xs }}>
                      <Button
                        title="Build a lineup"
                        variant="accent"
                        disabled={!ready}
                        onPress={() => router.push(`/nominate/${s.single_id}`)}
                      />
                      <Button
                        title="Edit your vouch"
                        variant="ghost"
                        onPress={() => router.push(`/vouch/${s.single_id}`)}
                      />
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          ) : null}

          {couldVouch.length > 0 ? (
            <Stack gap={spacing.sm}>
              <Label>Friends you could vouch for</Label>
              {couldVouch.map((c) => (
                <ListRow
                  key={c.id}
                  title={c.first_name}
                  subtitle={c.city ?? undefined}
                  left={<Avatar uri={c.photo_url} name={c.first_name} size={44} />}
                  right={
                    <Button
                      title="Vouch"
                      small
                      full={false}
                      variant="secondary"
                      onPress={() => router.push(`/vouch/${c.id}`)}
                    />
                  }
                />
              ))}
            </Stack>
          ) : null}

          <Button title="Invite a friend" variant="secondary" onPress={goInvite} />

          {watching.length > 0 ? (
            <Stack gap={spacing.sm}>
              <Label>Lineups you&apos;re watching</Label>
              {watching.map((l) => (
                <Card key={l.id} onPress={() => router.push(`/lineup/${l.id}`)}>
                  <Body>{l.single.first_name}&apos;s lineup</Body>
                  <Caption>
                    {lineupStatusLabel[l.status]}. {l.kept} {l.kept === 1 ? 'person' : 'people'}{' '}
                    kept.
                  </Caption>
                </Card>
              ))}
            </Stack>
          ) : null}
        </Stack>
      );
    }
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Title style={{ marginBottom: spacing.lg }}>Your singles</Title>
        {content}
      </ScrollView>
    </Screen>
  );
}
