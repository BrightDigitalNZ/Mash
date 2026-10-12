// Catch only. Pick a friend who knows you and knows people. We ask them. They can say no.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Empty,
  ErrorView,
  Footer,
  ListRow,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useAppSettings, useConnections, useMyMashmakers } from '@/hooks/useData';
import { askMashmaker } from '@/lib/api';
import { copy } from '@/lib/copy';
import { homeFor, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const CAP_LINE = 'You’ve picked as many Mashmakers as Mash allows for now.';

export default function Ask() {
  const userId = useSession((s) => s.session?.user.id);
  const updateProfile = useSession((s) => s.updateProfile);
  const qc = useQueryClient();
  const people = useConnections();
  const links = useMyMashmakers();
  const settings = useAppSettings();

  const [asking, setAsking] = useState<string | null>(null);
  const [asked, setAsked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const cap = Number(settings.data?.mashmaker_cap ?? '0');
  const byId = new Map((links.data ?? []).map((l) => [l.mashmaker_id, l.status]));
  const picked = new Set([
    ...(links.data ?? [])
      .filter((l) => l.status === 'accepted' || l.status === 'requested')
      .map((l) => l.mashmaker_id),
    ...asked,
  ]);
  const atCap = cap > 0 && picked.size >= cap;

  async function ask(id: string) {
    if (!userId || asking) return;
    setAsking(id);
    setError(null);
    try {
      await askMashmaker(userId, id);
      setAsked((list) => [...list, id]);
      qc.invalidateQueries({ queryKey: keys.mashmakers });
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setAsking(null);
    }
  }

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    try {
      const updated = await updateProfile({ onboarding_complete: true });
      router.replace(homeFor(updated) as never);
    } catch {
      setError(copy.errors.didNotSave);
      setFinishing(false);
    }
  }

  function statusFor(id: string): 'accepted' | 'asked' | null {
    const s = byId.get(id);
    if (s === 'accepted') return 'accepted';
    if (s === 'requested' || asked.includes(id)) return 'asked';
    return null;
  }

  const list = people.data ?? [];

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={spacing.xl}>
          <Stack gap={spacing.sm}>
            <Title>Pick a Mashmaker</Title>
            <Body color={colors.textSecondary}>{copy.onboarding.pickMashmaker}</Body>
          </Stack>

          {people.isLoading ? (
            <Loading />
          ) : people.isError ? (
            <ErrorView message={copy.errors.didNotLoad} onRetry={() => people.refetch()} />
          ) : list.length === 0 ? (
            <Empty
              title="No one here yet"
              body="Nobody in your contacts is on Mash yet. Invite a friend and we’ll ask them when they join."
            />
          ) : (
            <Stack gap={0}>
              {atCap ? <Caption>{CAP_LINE}</Caption> : null}
              {list.map((p) => {
                const status = statusFor(p.id);
                return (
                  <ListRow
                    key={p.id}
                    title={p.first_name}
                    subtitle={p.city ?? undefined}
                    left={<Avatar uri={p.photo_url} name={p.first_name} size={44} />}
                    right={
                      status === 'accepted' ? (
                        <Caption>Your Mashmaker</Caption>
                      ) : status === 'asked' ? (
                        <Caption>Asked</Caption>
                      ) : (
                        <Button
                          title="Ask"
                          variant="secondary"
                          small
                          full={false}
                          onPress={() => ask(p.id)}
                          loading={asking === p.id}
                          disabled={atCap || (!!asking && asking !== p.id)}
                          accessibilityLabel={`Ask ${p.first_name} to be your Mashmaker`}
                        />
                      )
                    }
                  />
                );
              })}
            </Stack>
          )}

          <Button
            title="No one here yet? Invite a friend"
            variant="ghost"
            onPress={() => router.push('/invite' as never)}
          />
        </Stack>
      </ScrollView>
      <Footer>
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        <Button
          title={picked.size > 0 ? 'Finish' : 'Finish for now'}
          onPress={finish}
          loading={finishing}
        />
        {picked.size === 0 ? (
          <Caption center>You can pick a Mashmaker any time from your Mashmakers tab.</Caption>
        ) : null}
      </Footer>
    </Screen>
  );
}
