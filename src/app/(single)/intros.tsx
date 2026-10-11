// Introductions. Each one came from a friend's lineup; none came from a stranger.

import { router } from 'expo-router';
import React, { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import { Avatar, Caption, Empty, ErrorView, Heading, ListRow, Loading, Screen, Stack, Title } from '@/components/ui';
import { useIntros, type IntroWithPeople } from '@/hooks/useData';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** "Holly", "Holly and Kim", "Holly, Kim and Sam". */
function names(list: string[]): string {
  if (list.length === 0) return 'A friend';
  if (list.length === 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function Section({ title, rows }: { title: string; rows: IntroWithPeople[] }) {
  if (rows.length === 0) return null;
  return (
    <Stack gap={spacing.xs}>
      <Heading>{title}</Heading>
      {rows.map((i) => {
        const vouched = `Vouched by ${names(i.vouchers.map((v) => v.first_name))}`;
        const preview = i.lastMessage && !i.lastMessage.is_vouch ? i.lastMessage.body : null;
        return (
          <ListRow
            key={i.id}
            title={i.other.first_name}
            subtitle={[vouched, preview].filter(Boolean).join('\n')}
            left={<Avatar uri={i.other.photo_url} name={i.other.first_name} size={48} />}
            onPress={() => router.push(`/intro/${i.id}`)}
          />
        );
      })}
    </Stack>
  );
}

export default function IntrosScreen() {
  const me = useSession((s) => s.session?.user.id);
  const intros = useIntros();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await intros.refetch();
    } finally {
      setRefreshing(false);
    }
  }

  const all = [...(intros.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const mine = (i: IntroWithPeople) => (i.single_id === me ? i.single_decision : i.candidate_decision);

  const waitingOnMe = all.filter((i) => i.status === 'pending' && mine(i) === 'undecided');
  const waitingOnThem = all.filter((i) => i.status === 'pending' && mine(i) === 'meet');
  const talking = all.filter((i) => i.status === 'mutual' || i.status === 'met');
  const closed = all.filter((i) => i.status === 'declined' || i.status === 'closed');

  let content: React.ReactNode;
  if (intros.isLoading) {
    content = <Loading />;
  } else if (intros.isError) {
    content = <ErrorView message="Your introductions didn't load." onRetry={() => intros.refetch()} />;
  } else if (all.length === 0) {
    content = (
      <Empty title="No introductions yet" body="They come from lineups. Your circle is working on it." />
    );
  } else {
    content = (
      <Stack gap={spacing.xl}>
        <Section title="Waiting on you" rows={waitingOnMe} />
        <Section title="Waiting on them" rows={waitingOnThem} />
        <Section title="Talking" rows={talking} />
        <Section title="Closed" rows={closed} />
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
        <Stack gap={spacing.xl}>
          <Stack gap={spacing.xs}>
            <Title>Intros</Title>
            <Caption>One at a time, each with a friend behind it.</Caption>
          </Stack>
          {content}
        </Stack>
      </ScrollView>
    </Screen>
  );
}
