// A mash: an introduction by a Mashmaker between two Catches. Both always know who mashed
// them. A yes opens the conversation; a no is quiet and final. The Machine's checks are only
// ever the requester's. Nobody's criteria are shown to the other person.

import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import BackChevron, { backOrHome } from '@/components/BackChevron';
import MashChat from '@/components/MashChat';
import MashChecksCard from '@/components/MashChecksCard';
import MashOutcomeCard from '@/components/MashOutcomeCard';
import MashSafetyActions from '@/components/MashSafetyActions';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Divider,
  Empty,
  ErrorView,
  Field,
  Footer,
  Heading,
  Loading,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import {
  isEntitled,
  keys,
  useAppSettings,
  useBrief,
  useMash,
  useMessages,
  useOutcomes,
  useVouchesFor,
} from '@/hooks/useData';
import { decideMash, sendMessage } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

/** "Holly", "Holly and Kim", "Holly, Kim and Sam". */
function names(list: string[]): string {
  if (list.length === 0) return 'A friend';
  if (list.length === 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

export default function MashScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const qc = useQueryClient();

  const q = useMash(id);
  const mash = q.data ?? null;
  const other = mash?.other;
  const chatOpen = mash?.status === 'mutual' || mash?.status === 'met';

  const settings = useAppSettings();
  const vouches = useVouchesFor(other?.id);
  const messages = useMessages(chatOpen ? id : undefined);
  const outcomes = useOutcomes(chatOpen ? id : undefined);
  const brief = useBrief(chatOpen ? id : undefined);

  const scrollRef = useRef<ScrollView>(null);
  const [deciding, setDeciding] = useState<'meet' | 'pass' | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messageCount = messages.data?.length ?? 0;
  useEffect(() => {
    if (chatOpen && messageCount > 0) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [chatOpen, messageCount]);

  if (q.isLoading) {
    return (
      <Screen>
        <BackChevron />
        <Loading />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <BackChevron />
        <ErrorView message={copy.errors.didNotLoad} onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  if (!mash || !other || !me || !id) {
    return (
      <Screen>
        <BackChevron />
        <Empty title="This mash isn’t here." body="It may have closed." />
      </Screen>
    );
  }

  const mashId = id;
  const iAmCandidate = mash.candidate_id === me;
  const mashmakerNames = names(mash.mashmakers.map((m) => m.first_name));
  const mashmakerIds = new Set(mash.mashmaker_ids);

  // Declined, closed or timed out: the line, nothing else.
  if (mash.status === 'declined' || mash.status === 'closed' || mash.status === 'expired') {
    const line = mash.status === 'expired' ? copy.decline.timedOut : copy.decline.didNotGoAhead;
    return (
      <Screen>
        <Stack gap={spacing.xl}>
          <BackChevron />
          <Body center>{line}</Body>
          <View testID="mash-done">
            <Button title="Done" variant="secondary" onPress={() => backOrHome(profile)} />
          </View>
        </Stack>
      </Screen>
    );
  }

  async function decide(decision: 'meet' | 'pass') {
    if (deciding) return;
    setDeciding(decision);
    setError(null);
    try {
      await decideMash(mashId, decision);
      await qc.invalidateQueries({ queryKey: keys.mash(mashId) });
      qc.invalidateQueries({ queryKey: keys.mashes });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setDeciding(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!me || !text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(mashId, me, text);
      setDraft('');
      qc.invalidateQueries({ queryKey: keys.messages(mashId) });
      qc.invalidateQueries({ queryKey: keys.mashes });
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setSending(false);
    }
  }

  // --- sections -------------------------------------------------------------

  const header = (
    <Stack gap={spacing.lg} align="center">
      <Avatar uri={other.photo_url} name={other.first_name} size={120} />
      <Stack gap={spacing.xs} align="center">
        <Title center>{other.first_name}</Title>
        {other.city ? <Caption center>{other.city}</Caption> : null}
        <Caption center color={colors.textSecondary}>
          Mashed by {mashmakerNames}
        </Caption>
        {other.verified_identity ? <Caption center>Identity verified</Caption> : null}
        {other.photos_current ? <Caption center>Photos checked current</Caption> : null}
      </Stack>
      {other.bio ? (
        <Body center color={colors.textSecondary}>
          {other.bio}
        </Body>
      ) : null}
    </Stack>
  );

  const notes = (vouches.data ?? []).filter((v) => mashmakerIds.has(v.mashmaker_id));
  const noteList =
    notes.length > 0 ? (
      <Stack gap={spacing.md}>
        {notes.map((v) => (
          <Quote key={v.id} text={v.text} by={`${v.mashmaker.first_name} on ${other.first_name}`} />
        ))}
      </Stack>
    ) : null;

  let middle: React.ReactNode = null;
  if (mash.status === 'pending' && iAmCandidate && mash.candidate_decision === 'undecided') {
    middle = (
      <Stack gap={spacing.md}>
        <Heading>{mash.catch.first_name} said yes to meeting you.</Heading>
        <View testID="mash-meet">
          <Button
            title="Meet"
            variant="accent"
            onPress={() => decide('meet')}
            loading={deciding === 'meet'}
            disabled={!!deciding}
          />
        </View>
        <View testID="mash-pass">
          <Button
            title="Not this time"
            variant="ghost"
            onPress={() => decide('pass')}
            loading={deciding === 'pass'}
            disabled={!!deciding}
          />
        </View>
      </Stack>
    );
  } else if (mash.status === 'pending') {
    middle = <Body center>{copy.accept.waiting(other.first_name)}</Body>;
  }

  const needsPlus = settings.data?.dd_requires_plus === 'true' && !isEntitled(profile);

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.sm,
            paddingBottom: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            <BackChevron />
            {header}
            {noteList}
            {middle}
            {chatOpen ? (
              <MashOutcomeCard
                mashId={mashId}
                me={me}
                mashmakerNames={mashmakerNames}
                outcomes={outcomes.data ?? []}
              />
            ) : null}
            {chatOpen ? (
              <MashChecksCard
                mashId={mashId}
                otherName={other.first_name}
                brief={brief.data ?? null}
                loading={brief.isLoading || settings.isLoading}
                needsPlus={needsPlus}
              />
            ) : null}
            {chatOpen ? <Divider /> : null}
            {chatOpen ? (
              <MashChat messages={messages.data ?? []} me={me} loading={messages.isLoading} />
            ) : null}
            {error ? <Caption color={colors.danger}>{error}</Caption> : null}
            <MashSafetyActions mashId={mashId} me={me} other={other} />
          </Stack>
        </ScrollView>
        {chatOpen ? (
          <Footer>
            <Stack row gap={spacing.sm} align="flex-end">
              <Field
                style={{ flex: 1 }}
                placeholder={`Message ${other.first_name}`}
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={1000}
                accessibilityLabel={`Message ${other.first_name}`}
              />
              <View testID="send-message">
                <Button
                  title="Send"
                  small
                  full={false}
                  onPress={send}
                  loading={sending}
                  disabled={!draft.trim()}
                />
              </View>
            </Stack>
          </Footer>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}
