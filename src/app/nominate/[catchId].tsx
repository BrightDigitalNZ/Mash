// Pick people for a Catch. Only people the Mashmaker knows. The Machine filters anyone who does
// not fit what the Catch asked for, and asks each person before the Catch sees them.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Avatar, Body, Button, Caption, Empty, ErrorView, Footer, Heading, Label, ListRow, Loading, Quote, Screen, Stack, Title } from '@/components/ui';
import { keys, useAppSettings, useCriteria, useNominatable, useProfile } from '@/hooks/useData';
import { buildBatch, type BuildBatchResult } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';
import type { Criteria, IntentKind } from '@/types/database';

const INTENT: Record<IntentKind, string> = {
  relationship: 'a relationship',
  see_where_it_goes: 'seeing where it goes',
  companionship: 'companionship',
  not_sure: 'not sure yet',
};

/** What the Catch is after, in words. Never their age range, never a number about them. */
function afterLines(c: Criteria | null | undefined): string[] {
  if (!c) return [];
  const lines = [`They’re after: ${INTENT[c.intent]}.`];
  if (c.dealbreakers.length) lines.push(`Dealbreakers: ${c.dealbreakers.join(', ')}.`);
  if (c.open_text?.trim()) lines.push(`In their words: “${c.open_text.trim()}”`);
  return lines;
}

export default function NominateScreen() {
  const { catchId } = useLocalSearchParams<{ catchId: string }>();
  const qc = useQueryClient();
  const person = useProfile(catchId);
  const nominatable = useNominatable(catchId);
  const criteria = useCriteria(catchId);
  const settings = useAppSettings();

  const [picked, setPicked] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BuildBatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = person.data?.first_name ?? 'them';
  const people = nominatable.data ?? [];
  const max = Number(settings.data?.batch_max ?? '5') || 5;

  const toggle = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  };

  const send = async () => {
    if (!catchId || picked.length === 0) return;
    setSending(true);
    setError(null);
    try {
      const res = await buildBatch(catchId, picked);
      setResult(res);
      qc.invalidateQueries({ queryKey: keys.batches });
      qc.invalidateQueries({ queryKey: keys.catches });
      qc.invalidateQueries({ queryKey: keys.nominatable(catchId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.errors.didNotSend);
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
        <Loading label="The Machine is reading your picks." />
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen>
        {close}
        <Stack gap={spacing.xl}>
          <Heading>Sent for {name}</Heading>
          <Body>
            {result.kept} {result.kept === 1 ? 'person' : 'people'} kept.
          </Body>
          {result.note ? <Quote text={result.note} by="The Machine" /> : null}
          {result.dropped.length > 0 ? (
            <Stack gap={spacing.sm}>
              <Label>Set aside</Label>
              {result.dropped.map((d) => (
                <ListRow key={d.candidate_id} title={d.first_name} subtitle={d.reason} />
              ))}
            </Stack>
          ) : null}
          {result.kept > 0 ? <Caption>They’ve been asked. You’ll know when the batch is ready.</Caption> : null}
          <Button title="Done" onPress={() => router.replace(`/batch/${result.batchId}`)} />
        </Stack>
      </Screen>
    );
  }

  const loading = person.isLoading || nominatable.isLoading || criteria.isLoading || settings.isLoading;

  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {close}
          {loading ? (
            <Loading />
          ) : nominatable.error ? (
            <ErrorView message={copy.errors.didNotLoad} onRetry={() => nominatable.refetch()} />
          ) : (
            <Stack gap={spacing.lg}>
              <Stack gap={spacing.xs}>
                <Title>Pick people for {name}</Title>
                <Caption>
                  Only people you know. The Machine filters anyone who doesn’t fit what {name} asked for, and asks each person before {name} sees them.
                </Caption>
              </Stack>

              {afterLines(criteria.data).length > 0 ? (
                <Stack gap={spacing.xs}>
                  {afterLines(criteria.data).map((line) => (
                    <Caption key={line} color={colors.textSecondary}>
                      {line}
                    </Caption>
                  ))}
                </Stack>
              ) : null}

              {people.length === 0 ? (
                <Empty title="No one yet" body={copy.empty.nominatable(name)} action={{ title: 'Invite a friend', onPress: () => router.push('/invite') }} />
              ) : (
                <Stack gap={0}>
                  <Label>
                    {picked.length} of {max}
                  </Label>
                  {people.map((p) => {
                    const on = picked.includes(p.candidate_id);
                    const full = !on && picked.length >= max;
                    return (
                      <ListRow
                        key={p.candidate_id}
                        title={p.first_name}
                        subtitle={full ? 'That’s the most for one batch.' : (p.city ?? undefined)}
                        left={<Avatar uri={p.photo_url} name={p.first_name} size={44} />}
                        right={
                          <Ionicons
                            name={on ? 'checkmark-circle' : 'ellipse-outline'}
                            size={26}
                            color={on ? colors.accent : colors.textMuted}
                            accessibilityLabel={on ? `${p.first_name} picked` : `Pick ${p.first_name}`}
                          />
                        }
                        onPress={() => toggle(p.candidate_id)}
                        style={full ? { opacity: 0.5 } : undefined}
                      />
                    );
                  })}
                </Stack>
              )}
              {error ? <Caption color={colors.danger}>{error}</Caption> : null}
            </Stack>
          )}
        </ScrollView>
        {!loading && !nominatable.error && people.length > 0 ? (
          <Footer>
            <View testID="send-batch">
              <Button title="Send to the Machine" disabled={picked.length === 0} onPress={send} />
            </View>
          </Footer>
        ) : null}
      </View>
    </Screen>
  );
}
