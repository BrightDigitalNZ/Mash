import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Empty,
  ErrorView,
  Footer,
  Heading,
  Label,
  ListRow,
  Loading,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useNominatable, useProfile } from '@/hooks/useData';
import { buildLineup, type BuildLineupResult } from '@/lib/api';
import { colors, spacing } from '@/theme';

const MAX_PICKS = 10;

export default function NominateScreen() {
  const { singleId } = useLocalSearchParams<{ singleId: string }>();
  const qc = useQueryClient();
  const single = useProfile(singleId);
  const nominatable = useNominatable(singleId);

  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BuildLineupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const firstName = single.data?.first_name ?? 'your friend';
  const people = nominatable.data ?? [];
  const nameOf = (id: string) => people.find((p) => p.candidate_id === id)?.first_name ?? 'Someone';

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PICKS) return prev;
      return [...prev, id];
    });
  };

  const send = async () => {
    if (!singleId || picked.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await buildLineup(singleId, picked);
      setResult(res);
      qc.invalidateQueries({ queryKey: keys.lineups });
      qc.invalidateQueries({ queryKey: keys.mySingles });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The matchmaker could not build this lineup.');
    } finally {
      setSending(false);
    }
  };

  const close = (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={12}
      style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
    >
      <Ionicons name="close" size={28} color={colors.primary} />
    </Pressable>
  );

  if (sending) {
    return (
      <Screen>
        {close}
        <Loading label="The matchmaker is reading the vouches..." />
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen>
        {close}
        <Stack gap={spacing.xl}>
          <Heading>Lineup sent to {firstName}</Heading>
          {result.note ? <Quote text={result.note} by="The matchmaker" /> : null}
          <Body>Kept {result.kept}</Body>
          {result.dropped.length > 0 ? (
            <Stack gap={spacing.sm}>
              <Label>Dropped</Label>
              {result.dropped.map((d) => (
                <ListRow key={d.candidate_id} title={nameOf(d.candidate_id)} subtitle={d.reason} />
              ))}
              <Caption>You can bring one of them back from the lineup.</Caption>
            </Stack>
          ) : null}
          <Button
            title="Watch the lineup"
            onPress={() => router.replace(`/lineup/${result.lineupId}`)}
          />
        </Stack>
      </Screen>
    );
  }

  const loading = single.isLoading || nominatable.isLoading;

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {close}
          {loading ? (
            <Loading />
          ) : nominatable.error ? (
            <ErrorView
              message="Could not load your contacts on Mash."
              onRetry={() => nominatable.refetch()}
            />
          ) : people.length === 0 ? (
            <Empty
              title="Nobody to nominate yet"
              body="Lineups are built from your own contacts who are single on Mash. Invite more friends."
              action={{ title: 'Invite', onPress: () => router.push('/invite') }}
            />
          ) : (
            <Stack gap={spacing.lg}>
              <Stack gap={spacing.xs}>
                <Title>Who&apos;s on {firstName}&apos;s lineup?</Title>
                <Caption>
                  Pick up to {MAX_PICKS}. The matchmaker keeps the ones that fit and tells you why
                  it dropped the rest.
                </Caption>
              </Stack>
              <Stack gap={0}>
                {people.map((p) => {
                  const on = picked.includes(p.candidate_id);
                  const details = [p.age ? `${p.age}` : null, p.city].filter(Boolean).join(', ');
                  return (
                    <ListRow
                      key={p.candidate_id}
                      title={p.first_name}
                      subtitle={details || undefined}
                      left={<Avatar uri={p.photo_url} name={p.first_name} size={44} />}
                      right={
                        <Ionicons
                          name={on ? 'checkmark-circle' : 'ellipse-outline'}
                          size={26}
                          color={on ? colors.accent : colors.textMuted}
                        />
                      }
                      onPress={() => toggle(p.candidate_id)}
                    />
                  );
                })}
              </Stack>
              {error ? <Caption color={colors.danger}>{error}</Caption> : null}
            </Stack>
          )}
        </ScrollView>
        {!loading && people.length > 0 ? (
          <Footer>
            <Button
              title={
                picked.length > 0
                  ? `Send to the matchmaker (${picked.length})`
                  : 'Send to the matchmaker'
              }
              variant="accent"
              disabled={picked.length === 0}
              onPress={send}
            />
          </Footer>
        ) : null}
      </View>
    </Screen>
  );
}
