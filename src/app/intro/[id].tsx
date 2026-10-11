// The introduction. It reads like a message from a friend, not a card to judge.
// Yes opens a chat with the vouch as the first message. No is quiet; nobody is told.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import BriefCard from '@/components/BriefCard';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Chip,
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
import { keys, useBrief, useIntro, useMessages, useVouchesFor, type IntroWithPeople } from '@/hooks/useData';
import { approveBrief, blockUser, decideIntro, generateBrief, reportOutcome, sendMessage, unmatch } from '@/lib/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { OutcomeKind } from '@/types/database';

/** "Holly", "Holly and Kim", "Holly, Kim and Sam". */
function names(list: string[]): string {
  if (list.length === 0) return 'A friend';
  if (list.length === 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

const outcomes: { label: string; kind: OutcomeKind }[] = [
  { label: "We're meeting", kind: 'meeting' },
  { label: 'We met', kind: 'met' },
  { label: 'Dating', kind: 'dating' },
  { label: 'Together', kind: 'together' },
  { label: 'Not for me', kind: 'not_for_me' },
  { label: 'Ended', kind: 'ended' },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(single)/intros');
}

export default function IntroScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const qc = useQueryClient();
  const q = useIntro(id);
  const intro = q.data ?? null;
  const other = intro?.other;
  const chatOpen = intro?.status === 'mutual' || intro?.status === 'met';

  const vouches = useVouchesFor(other?.id);
  const messages = useMessages(chatOpen ? id : undefined);
  const myBrief = useBrief(id, me);
  const theirBrief = useBrief(id, other?.id);

  const scrollRef = useRef<ScrollView>(null);
  const [deciding, setDeciding] = useState<'meet' | 'not_this_time' | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [savedOutcome, setSavedOutcome] = useState<OutcomeKind | null>(null);
  const [savingOutcome, setSavingOutcome] = useState<OutcomeKind | null>(null);
  const [building, setBuilding] = useState(false);
  const [sharing, setSharing] = useState(false);
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
        <TopBar />
        <Loading />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <TopBar />
        <ErrorView message="This introduction didn't load." onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  if (!intro || !other || !me || !id) {
    return (
      <Screen>
        <TopBar />
        <Empty title="This introduction isn't here" body="It may have been closed." />
      </Screen>
    );
  }

  const iAmCandidate = intro.candidate_id === me;
  const myDecision = iAmCandidate ? intro.candidate_decision : intro.single_decision;
  const voucherNames = names(intro.vouchers.map((v) => v.first_name));
  const closed = intro.status === 'declined' || intro.status === 'closed';
  const met = intro.status === 'met' || savedOutcome === 'dating' || savedOutcome === 'together';

  async function decide(decision: 'meet' | 'not_this_time') {
    if (!id || deciding) return;
    setDeciding(decision);
    setError(null);
    try {
      await decideIntro(id, decision);
      await qc.invalidateQueries({ queryKey: keys.intro(id) });
      qc.invalidateQueries({ queryKey: keys.intros });
      if (decision === 'not_this_time') goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    } finally {
      setDeciding(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!id || !me || !text || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(id, me, text);
      setDraft('');
      qc.invalidateQueries({ queryKey: keys.messages(id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t send. Try again.');
    } finally {
      setSending(false);
    }
  }

  async function saveOutcome(outcome: OutcomeKind) {
    if (!id || !me || savingOutcome) return;
    setSavingOutcome(outcome);
    setError(null);
    try {
      await reportOutcome({ introId: id, reportedBy: me, outcome });
      setSavedOutcome(outcome);
      qc.invalidateQueries({ queryKey: keys.intro(id) });
      qc.invalidateQueries({ queryKey: keys.intros });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    } finally {
      setSavingOutcome(null);
    }
  }

  async function buildBrief() {
    if (!id || !me || building) return;
    setBuilding(true);
    setError(null);
    try {
      await generateBrief(id);
      await qc.invalidateQueries({ queryKey: keys.brief(id, me) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The brief didn’t build. Try again.');
    } finally {
      setBuilding(false);
    }
  }

  async function shareBrief() {
    if (!id || !me || sharing) return;
    setSharing(true);
    setError(null);
    try {
      await approveBrief(id);
      await qc.invalidateQueries({ queryKey: keys.brief(id, me) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    } finally {
      setSharing(false);
    }
  }

  function more() {
    const otherName = other?.first_name ?? 'them';
    Alert.alert(otherName, undefined, [
      { text: 'Report', onPress: () => router.push(`/report/${other?.id}`) },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Block ${otherName}?`, 'They will not be able to reach you on Mash. This introduction closes.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                if (!me || !other || !id) return;
                try {
                  await blockUser(me, other.id);
                  await unmatch(id);
                  qc.invalidateQueries({ queryKey: keys.intros });
                  goBack();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
                }
              },
            },
          ]),
      },
      {
        text: 'Unmatch',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Unmatch ${otherName}?`, 'This closes the introduction for both of you. Nobody else is told.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unmatch',
              style: 'destructive',
              onPress: async () => {
                if (!id) return;
                try {
                  await unmatch(id);
                  qc.invalidateQueries({ queryKey: keys.intros });
                  goBack();
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
                }
              },
            },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  // --- sections -------------------------------------------------------------

  const header = (
    <Stack gap={spacing.lg} align="center">
      <Avatar uri={other.photo_url} name={other.first_name} size={120} />
      <Stack gap={spacing.xs} align="center">
        <Title center>{other.first_name}</Title>
        <Caption center>{[other.age ? `${other.age}` : null, other.city].filter(Boolean).join(' · ')}</Caption>
        <Caption center color={colors.textSecondary}>
          {voucherNames} vouched for {other.first_name}
        </Caption>
      </Stack>
      {met ? (
        <Body center>
          {voucherNames} introduced {intro.single.first_name} to {intro.candidate.first_name}.
        </Body>
      ) : null}
    </Stack>
  );

  const vouchList = (
    <Stack gap={spacing.md}>
      {vouches.isLoading ? <Loading /> : null}
      {(vouches.data ?? []).map((v) => (
        <Quote key={v.id} text={v.text} by={v.voucher.first_name} />
      ))}
      {vouches.data && vouches.data.length === 0 ? (
        <Caption>{voucherNames} put {other.first_name} forward. The vouch is in the chat once you both say yes.</Caption>
      ) : null}
    </Stack>
  );

  let middle: React.ReactNode = null;
  if (closed) {
    middle = <Caption center>This introduction is closed.</Caption>;
  } else if (intro.status === 'pending' && iAmCandidate && myDecision === 'undecided') {
    middle = (
      <Stack gap={spacing.md}>
        <Body>
          {intro.single.first_name}, vouched by {voucherNames}, would like to meet you.
        </Body>
        <Button
          title="Yes, introduce us"
          variant="accent"
          onPress={() => decide('meet')}
          loading={deciding === 'meet'}
          disabled={!!deciding}
        />
        <Button
          title="Not this time"
          variant="ghost"
          onPress={() => decide('not_this_time')}
          loading={deciding === 'not_this_time'}
          disabled={!!deciding}
        />
      </Stack>
    );
  } else if (intro.status === 'pending') {
    middle = (
      <Stack gap={spacing.xs}>
        <Heading>Waiting on {other.first_name}.</Heading>
        <Caption>They&rsquo;ll see your yes when they open theirs.</Caption>
      </Stack>
    );
  }

  const outcomeRow = chatOpen ? (
    <Stack gap={spacing.md}>
      <Heading>How did it go?</Heading>
      <Stack row wrap gap={spacing.sm}>
        {outcomes.map((o) => (
          <Chip
            key={o.kind}
            label={o.label}
            selected={savedOutcome === o.kind}
            onPress={() => saveOutcome(o.kind)}
          />
        ))}
      </Stack>
      {savedOutcome ? <Caption color={colors.success}>Saved</Caption> : null}
    </Stack>
  ) : null;

  const briefs = !closed ? (
    <BriefSection
      intro={intro}
      me={me}
      isPlus={!!profile?.is_plus}
      mine={myBrief.data ?? null}
      theirs={theirBrief.data ?? null}
      loading={myBrief.isLoading || theirBrief.isLoading}
      building={building}
      sharing={sharing}
      onBuild={buildBrief}
      onShare={shareBrief}
    />
  ) : null;

  const chat = chatOpen ? (
    <Stack gap={spacing.md}>
      <Heading>The conversation</Heading>
      {messages.isLoading ? <Loading /> : null}
      {(messages.data ?? []).map((m) => {
        if (m.is_vouch) return <Quote key={m.id} text={m.body} by={voucherNames} />;
        const mine = m.sender_id === me;
        return (
          <Card
            key={m.id}
            tone={mine ? 'highlight' : 'surface'}
            style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
          >
            <Body>{m.body}</Body>
          </Card>
        );
      })}
      {messages.data && messages.data.length === 0 ? (
        <Caption>You both said yes. Say hello.</Caption>
      ) : null}
    </Stack>
  ) : null;

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            <TopBar onMore={more} />
            {header}
            {vouchList}
            {middle}
            {error ? <Caption color={colors.danger}>{error}</Caption> : null}
            {outcomeRow}
            {briefs}
            {chat ? <Divider /> : null}
            {chat}
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
              />
              <Button title="Send" small full={false} onPress={send} loading={sending} disabled={!draft.trim()} />
            </Stack>
          </Footer>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function TopBar({ onMore }: { onMore?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        style={({ pressed }) => [{ paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="chevron-back" size={28} color={colors.primary} />
      </Pressable>
      {onMore ? (
        <Pressable
          onPress={onMore}
          accessibilityRole="button"
          accessibilityLabel="More"
          hitSlop={12}
          style={({ pressed }) => [{ paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="ellipsis-horizontal" size={26} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

// --- the brief: consent-first due diligence ---------------------------------

type BriefRow = NonNullable<ReturnType<typeof useBrief>['data']>;

function BriefSection({
  intro,
  me,
  isPlus,
  mine,
  theirs,
  loading,
  building,
  sharing,
  onBuild,
  onShare,
}: {
  intro: IntroWithPeople;
  me: string;
  isPlus: boolean;
  mine: BriefRow | null;
  theirs: BriefRow | null;
  loading: boolean;
  building: boolean;
  sharing: boolean;
  onBuild: () => void;
  onShare: () => void;
}) {
  const myName = intro.single_id === me ? intro.single.first_name : intro.candidate.first_name;
  const other = intro.other;

  return (
    <Stack gap={spacing.lg}>
      <Stack gap={spacing.md}>
        <Heading>Your brief</Heading>
        {loading ? <Loading /> : null}
        {!loading && !mine ? (
          <Stack gap={spacing.sm}>
            <Caption>You see it first. Nothing is searched for; only what you linked in Settings.</Caption>
            <Button title="Build my brief" variant="secondary" onPress={onBuild} loading={building} />
          </Stack>
        ) : null}
        {mine ? (
          <Stack gap={spacing.sm}>
            <BriefCard content={mine.content} subjectName={myName} />
            {mine.subject_approved ? (
              <Caption>Shared with {other.first_name}.</Caption>
            ) : (
              <Stack gap={spacing.sm}>
                <Caption>You see it first. Nothing is searched for; only what you linked in Settings.</Caption>
                <Button title={`Share with ${other.first_name}`} onPress={onShare} loading={sharing} />
              </Stack>
            )}
          </Stack>
        ) : null}
      </Stack>

      <Stack gap={spacing.md}>
        <Heading>{other.first_name}&rsquo;s brief</Heading>
        {!isPlus ? (
          <Card tone="alt">
            <Body>See {other.first_name}&rsquo;s brief with Mash Plus</Body>
            <Caption>What they chose to share, read back plainly. Only once they have approved it.</Caption>
            <Button title="About Mash Plus" variant="secondary" full={false} small onPress={() => router.push('/settings/plus')} />
          </Card>
        ) : theirs && theirs.subject_approved ? (
          <BriefCard content={theirs.content} subjectName={other.first_name} />
        ) : (
          <Caption>{other.first_name} hasn&rsquo;t shared their brief yet.</Caption>
        )}
      </Stack>
    </Stack>
  );
}
