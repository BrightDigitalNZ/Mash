// Mashes. Every one came from a Mashmaker; none came from a stranger.

import { router } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import {
  Avatar,
  Body,
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
import { useMashes, type MashWithPeople } from '@/hooks/useData';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** "Holly", "Holly and Kim", "Holly, Kim and Sam". */
function names(list: string[]): string {
  if (list.length === 0) return 'A Mashmaker';
  if (list.length === 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function Row({
  mash,
  line,
  muted = false,
}: {
  mash: MashWithPeople;
  line: string;
  muted?: boolean;
}) {
  const other = mash.other;
  return (
    <Card
      tone={muted ? 'alt' : 'surface'}
      onPress={() => router.push(`/mash/${mash.id}`)}
      testID="open-mash"
      accessibilityLabel={`Open your mash with ${other.first_name}`}
    >
      <Stack row gap={spacing.md} align="center">
        <Avatar uri={other.photo_url} name={other.first_name} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Body color={muted ? colors.textSecondary : colors.text}>{other.first_name}</Body>
          <Caption numberOfLines={2}>{line}</Caption>
        </View>
      </Stack>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <Stack gap={spacing.sm}>
      <Heading>{title}</Heading>
      {children}
    </Stack>
  );
}

export default function MashesScreen() {
  const me = useSession((s) => s.session?.user.id);
  const mashes = useMashes();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await mashes.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const all = [...(mashes.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const waitingOnMe = all.filter(
    (m) => m.status === 'pending' && m.candidate_id === me && m.candidate_decision === 'undecided',
  );
  const waitingOnThem = all.filter((m) => m.status === 'pending' && !waitingOnMe.includes(m));
  const talking = all.filter((m) => m.status === 'mutual' || m.status === 'met');
  const over = all.filter(
    (m) => m.status === 'declined' || m.status === 'closed' || m.status === 'expired',
  );

  let content: React.ReactNode;
  if (mashes.isLoading) {
    content = <Loading />;
  } else if (mashes.isError) {
    content = <ErrorView message={copy.errors.didNotLoad} onRetry={() => mashes.refetch()} />;
  } else if (all.length === 0) {
    content = <Empty title="Nothing here yet" body={copy.empty.mashes} />;
  } else {
    content = (
      <Stack gap={spacing.xl}>
        <Section title="Waiting on you">
          {waitingOnMe.map((m) => (
            <Card
              key={m.id}
              tone="highlight"
              onPress={() => router.push(`/mash/${m.id}`)}
              testID="open-mash"
              accessibilityLabel={`See why ${names(m.mashmakers.map((p) => p.first_name))} picked you for ${m.other.first_name}`}
            >
              <Stack row gap={spacing.md} align="center">
                <Avatar uri={m.other.photo_url} name={m.other.first_name} size={48} />
                <View style={{ flex: 1 }}>
                  <Body>
                    {names(m.mashmakers.map((p) => p.first_name))}{' '}
                    {m.mashmakers.length > 1 ? 'have' : 'has'} picked you for {m.other.first_name}.
                    Here’s why.
                  </Body>
                </View>
              </Stack>
            </Card>
          ))}
        </Section>

        <Section title="Talking">
          {talking.map((m) => {
            const last = m.lastMessage && !m.lastMessage.is_vouch ? m.lastMessage.body : null;
            const by = `mashed by ${names(m.mashmakers.map((p) => p.first_name))}`;
            return <Row key={m.id} mash={m} line={last ? `${last}\n${by}` : by} />;
          })}
        </Section>

        <Section title="Waiting on them">
          {waitingOnThem.map((m) => (
            <Row key={m.id} mash={m} line={copy.accept.waiting(m.other.first_name)} />
          ))}
        </Section>

        <Section title="Didn’t go ahead">
          {over.map((m) => (
            <Row
              key={m.id}
              mash={m}
              line={m.status === 'expired' ? copy.decline.timedOut : copy.decline.didNotGoAhead}
              muted
            />
          ))}
        </Section>
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
        <Stack gap={spacing.xs}>
          <Title>Mashes</Title>
          <Caption>You both always know who introduced you.</Caption>
        </Stack>
        {content}
      </Stack>
    </Screen>
  );
}
