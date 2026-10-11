// One lineup, two seats. The single reveals it one person at a time and decides.
// The voucher sits on the couch and watches it happen, leaving the odd comment.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  ErrorView,
  Field,
  Heading,
  ListRow,
  Loading,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useLineup, useVouchesFor, type LineupWithPeople } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { commentOnLineup, decideEntry, markRevealed, overrideDrop, type Decision } from '@/lib/api';
import { useSession } from '@/store/session';
import { colors, radius, spacing } from '@/theme';
import type { EntryDecision } from '@/types/database';

type Entry = LineupWithPeople['entries'][number];

const decisionLabel: Record<EntryDecision, string> = {
  undecided: 'Undecided',
  meet: 'Meet',
  maybe: 'Maybe',
  not_this_time: 'Not this time',
};

function whenMade(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' });
}

function BackButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/(single)/circle'))}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={({ pressed }) => [{ alignSelf: 'flex-start', paddingVertical: spacing.sm }, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name="chevron-back" size={28} color={colors.primary} />
    </Pressable>
  );
}

function DecisionBadge({ decision }: { decision: EntryDecision }) {
  const bg = {
    undecided: colors.surfaceAlt,
    meet: colors.successSoft,
    maybe: colors.highlight,
    not_this_time: colors.surfaceAlt,
  }[decision];
  const fg = decision === 'undecided' ? colors.textMuted : colors.text;
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
      <Caption color={fg}>{decisionLabel[decision]}</Caption>
    </View>
  );
}

function tally(entries: Entry[]) {
  const t = { meet: 0, maybe: 0, not_this_time: 0, undecided: 0 };
  for (const e of entries) t[e.decision] += 1;
  return t;
}

// --- route ------------------------------------------------------------------

export default function LineupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.session?.user.id);
  const q = useLineup(id);

  if (q.isLoading) {
    return (
      <Screen>
        <BackButton />
        <Loading />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <BackButton />
        <ErrorView message="This lineup didn't load." onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  const lineup = q.data;
  if (!lineup || !me) {
    return (
      <Screen>
        <BackButton />
        <Empty title="This lineup isn't here" body="It may have been removed." />
      </Screen>
    );
  }
  if (me === lineup.single_id) return <SingleReveal lineup={lineup} />;
  if (me === lineup.voucher_id) return <VoucherCouch lineup={lineup} me={me} />;
  return (
    <Screen>
      <BackButton />
      <Empty title="Not yours to see" body="Lineups are only visible to the single and the friend who made them." />
    </Screen>
  );
}

// --- single mode: the reveal ------------------------------------------------

function SingleReveal({ lineup }: { lineup: LineupWithPeople }) {
  const qc = useQueryClient();
  const kept = useMemo(() => lineup.entries.filter((e) => e.kept), [lineup.entries]);
  const firstUndecided = kept.findIndex((e) => e.decision === 'undecided');
  const [index, setIndex] = useState(firstUndecided === -1 ? kept.length : firstUndecided);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track(Events.lineupOpened, { lineupId: lineup.id, kept: kept.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineup.id]);

  const entry = kept[index];
  const vouches = useVouchesFor(entry?.candidate.id);
  const voucherVouch = (vouches.data ?? []).find((v) => v.voucher_id === lineup.voucher_id) ?? null;
  const isRevealed = !!entry && (revealed[entry.id] === true || !!entry.revealed_at);

  const lineupComments = lineup.comments.filter((c) => c.entry_id === null);
  const entryComments = entry ? lineup.comments.filter((c) => c.entry_id === entry.id) : [];

  function reveal() {
    if (!entry) return;
    setRevealed((r) => ({ ...r, [entry.id]: true }));
    markRevealed(entry.id).catch(() => {});
  }

  function next() {
    setError(null);
    setIndex((i) => Math.min(i + 1, kept.length));
  }

  async function decide(decision: Decision) {
    if (!entry || busy) return;
    setBusy(decision);
    setError(null);
    try {
      await decideEntry(entry.id, decision);
      await qc.invalidateQueries({ queryKey: keys.lineup(lineup.id) });
      qc.invalidateQueries({ queryKey: keys.intros });
      next();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <Stack gap={spacing.xs}>
      <BackButton />
      <Title>{lineup.voucher.first_name}&rsquo;s lineup</Title>
      <Caption>Made {whenMade(lineup.created_at)}</Caption>
    </Stack>
  );

  const voucherNotes =
    lineupComments.length > 0 ? (
      <Stack gap={spacing.sm}>
        {lineupComments.map((c) => (
          <Quote key={c.id} text={c.text} by={lineup.voucher.first_name} />
        ))}
      </Stack>
    ) : null;

  if (kept.length === 0) {
    return (
      <Screen>
        <Stack gap={spacing.xl}>
          {header}
          {voucherNotes}
          <Empty
            title="Nobody made the cut this time"
            body={`The matchmaker didn’t find a fit among the people ${lineup.voucher.first_name} put forward. The next lineup arrives when another friend nominates.`}
            action={{ title: 'Back to your circle', onPress: () => router.replace('/(single)/circle') }}
          />
        </Stack>
      </Screen>
    );
  }

  // The end: a summary, not a scoreboard.
  if (!entry) {
    const t = tally(kept);
    return (
      <Screen>
        <Stack gap={spacing.xl}>
          {header}
          {voucherNotes}
          <Card>
            <Heading>
              {t.meet} meet, {t.maybe} maybe
            </Heading>
            <Body color={colors.textSecondary}>
              That&rsquo;s the lineup. The next one arrives when another friend nominates.
            </Body>
          </Card>
          <Stack gap={0}>
            {kept.map((e, i) => (
              <ListRow
                key={e.id}
                title={e.candidate.first_name}
                subtitle={e.reason ?? undefined}
                left={<Avatar uri={e.candidate.photo_url} name={e.candidate.first_name} size={40} />}
                right={<DecisionBadge decision={e.decision} />}
                onPress={() => {
                  setRevealed((r) => ({ ...r, [e.id]: true }));
                  setIndex(i);
                }}
              />
            ))}
          </Stack>
          <Button title="Back to your circle" onPress={() => router.replace('/(single)/circle')} />
        </Stack>
      </Screen>
    );
  }

  const c = entry.candidate;
  const quoteText = voucherVouch?.text ?? entry.reason ?? `${lineup.voucher.first_name} put ${c.first_name} forward for you.`;
  const reasonLine = voucherVouch ? entry.reason : null;
  const decided = entry.decision !== 'undecided';

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        {header}
        {voucherNotes}
        <Caption>
          {index + 1} of {kept.length}
        </Caption>

        <Card style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Quote text={quoteText} by={lineup.voucher.first_name} />
          {reasonLine ? <Caption>{reasonLine}</Caption> : null}

          {entryComments.length > 0 ? (
            <Stack gap={spacing.sm}>
              {entryComments.map((cm) => (
                <Quote key={cm.id} text={cm.text} by={lineup.voucher.first_name} />
              ))}
            </Stack>
          ) : null}

          {!isRevealed ? (
            <Button title="Reveal" onPress={reveal} />
          ) : (
            <Stack gap={spacing.lg} align="center">
              <Avatar uri={c.photo_url} name={c.first_name} size={160} />
              <Stack gap={spacing.xs} align="center">
                <Heading center>{c.first_name}</Heading>
                <Caption center>{[c.age ? `${c.age}` : null, c.city].filter(Boolean).join(' · ')}</Caption>
              </Stack>
              {c.bio ? (
                <Body center color={colors.textSecondary}>
                  {c.bio}
                </Body>
              ) : null}
              <Divider />
              {decided ? (
                <Stack gap={spacing.md} align="center" style={{ alignSelf: 'stretch' }}>
                  <Stack row gap={spacing.sm} align="center">
                    <Caption>You said</Caption>
                    <DecisionBadge decision={entry.decision} />
                  </Stack>
                  <Button title={index + 1 < kept.length ? 'Next' : 'Finish'} variant="secondary" onPress={next} />
                </Stack>
              ) : (
                <Stack gap={spacing.sm} style={{ alignSelf: 'stretch' }}>
                  <Button title="Meet" variant="accent" onPress={() => decide('meet')} loading={busy === 'meet'} disabled={!!busy} />
                  <Button title="Maybe" variant="secondary" onPress={() => decide('maybe')} loading={busy === 'maybe'} disabled={!!busy} />
                  <Button
                    title="Not this time"
                    variant="ghost"
                    onPress={() => decide('not_this_time')}
                    loading={busy === 'not_this_time'}
                    disabled={!!busy}
                  />
                  {error ? <Caption color={colors.danger}>{error}</Caption> : null}
                </Stack>
              )}
            </Stack>
          )}
        </Card>
      </Stack>
    </Screen>
  );
}

// --- voucher mode: the couch seat ------------------------------------------

function VoucherCouch({ lineup, me }: { lineup: LineupWithPeople; me: string }) {
  const qc = useQueryClient();
  const kept = lineup.entries.filter((e) => e.kept);
  const dropped = lineup.entries.filter((e) => !e.kept);
  const canBringBack = !lineup.entries.some((e) => e.voucher_overrode);
  const t = tally(kept);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [entryText, setEntryText] = useState('');
  const [lineupText, setLineupText] = useState('');
  const [sending, setSending] = useState(false);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summary = [
    `${t.meet} meet`,
    `${t.maybe} maybe`,
    `${t.not_this_time} not this time`,
    `${t.undecided} to go`,
  ].join(', ');

  async function comment(entryId: string | null, text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await commentOnLineup({ lineupId: lineup.id, entryId, authorId: me, text: trimmed });
      if (entryId) setEntryText('');
      else setLineupText('');
      qc.invalidateQueries({ queryKey: keys.lineup(lineup.id) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t send. Try again.');
    } finally {
      setSending(false);
    }
  }

  async function bringBack(entryId: string) {
    if (overriding) return;
    setOverriding(entryId);
    setError(null);
    try {
      await overrideDrop(entryId);
      qc.invalidateQueries({ queryKey: keys.lineup(lineup.id) });
      qc.invalidateQueries({ queryKey: keys.lineups });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That didn’t save. Try again.');
    } finally {
      setOverriding(null);
    }
  }

  const lineupComments = lineup.comments.filter((c) => c.entry_id === null);

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.xs}>
          <BackButton />
          <Title>Your lineup for {lineup.single.first_name}</Title>
          <Caption>Made {whenMade(lineup.created_at)}</Caption>
          <Body style={{ marginTop: spacing.sm }}>{summary}</Body>
        </Stack>

        {lineup.agent_note_to_voucher ? (
          <Card tone="highlight">
            <Caption>From the matchmaker</Caption>
            <Body>{lineup.agent_note_to_voucher}</Body>
          </Card>
        ) : null}

        <Stack gap={spacing.sm}>
          <Heading>Kept</Heading>
          {kept.length === 0 ? <Caption>Nobody was kept this time.</Caption> : null}
          {kept.map((e) => {
            const open = expanded === e.id;
            const comments = lineup.comments.filter((c) => c.entry_id === e.id);
            return (
              <View key={e.id}>
                <ListRow
                  title={e.candidate.first_name + (e.voucher_overrode ? ' (you brought back)' : '')}
                  subtitle={e.reason ?? undefined}
                  left={<Avatar uri={e.candidate.photo_url} name={e.candidate.first_name} size={44} />}
                  right={<DecisionBadge decision={e.decision} />}
                  onPress={() => {
                    setExpanded(open ? null : e.id);
                    setEntryText('');
                  }}
                />
                {open ? (
                  <Card tone="alt" style={{ marginBottom: spacing.sm }}>
                    {comments.map((c) => (
                      <Quote key={c.id} text={c.text} />
                    ))}
                    <Field
                      placeholder={`One line about ${e.candidate.first_name}`}
                      value={entryText}
                      onChangeText={setEntryText}
                      maxLength={200}
                      multiline
                    />
                    <Button
                      title="Comment"
                      small
                      full={false}
                      loading={sending}
                      disabled={!entryText.trim()}
                      onPress={() => comment(e.id, entryText)}
                    />
                  </Card>
                ) : null}
              </View>
            );
          })}
        </Stack>

        <Stack gap={spacing.sm}>
          {lineupComments.map((c) => (
            <Quote key={c.id} text={c.text} />
          ))}
          <Field
            label="Say something about the whole lineup"
            placeholder={`${lineup.single.first_name} sees this at the top`}
            value={lineupText}
            onChangeText={setLineupText}
            maxLength={200}
            multiline
          />
          <Button
            title="Comment"
            variant="secondary"
            small
            full={false}
            loading={sending}
            disabled={!lineupText.trim()}
            onPress={() => comment(null, lineupText)}
          />
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        </Stack>

        {dropped.length > 0 ? (
          <Stack gap={spacing.sm}>
            <Heading>The matchmaker dropped</Heading>
            <Caption>
              {canBringBack
                ? 'You can bring one person back. Pick carefully; it is one.'
                : 'You have used your one bring-back for this lineup.'}
            </Caption>
            {dropped.map((e) => (
              <ListRow
                key={e.id}
                title={e.candidate.first_name}
                subtitle={e.dropped_reason ?? undefined}
                left={<Avatar uri={e.candidate.photo_url} name={e.candidate.first_name} size={44} />}
                right={
                  canBringBack ? (
                    <Button
                      title="Bring back"
                      variant="secondary"
                      small
                      full={false}
                      loading={overriding === e.id}
                      disabled={!!overriding}
                      onPress={() => bringBack(e.id)}
                    />
                  ) : undefined
                }
              />
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}
