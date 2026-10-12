// The Catch's side of a batch: a reveal, one person at a time, in reveal order.
// First the Mashmaker's reason, then the person, then a yes, a maybe, or a no beside it.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import BackChevron from '@/components/BackChevron';
import BatchThread from '@/components/BatchThread';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Empty,
  Heading,
  ListRow,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, type BatchWithPeople } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { decideEntry, markRevealed, type Decision } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, radius, spacing } from '@/theme';
import type { EntryDecision } from '@/types/database';

type Entry = BatchWithPeople['entries'][number];

const decisionWord: Record<EntryDecision, string> = {
  undecided: 'Not yet',
  meet: 'Meet',
  maybe: 'Maybe',
  pass: 'Not this time',
};

function Pill({ text }: { text: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
      }}
    >
      <Caption color={colors.text}>{text}</Caption>
    </View>
  );
}

export default function BatchReveal({ batch, me }: { batch: BatchWithPeople; me: string }) {
  const qc = useQueryClient();
  const mm = batch.mashmaker.first_name;
  const kept = useMemo(
    () => batch.entries.filter((e) => e.kept && e.consent === 'yes'),
    [batch.entries],
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [revisit, setRevisit] = useState<string | null>(null);
  const [mashIds, setMashIds] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track(Events.batchOpened, { batchId: batch.id, kept: kept.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.id]);

  const decided = kept.filter((e) => e.decision !== 'undecided');
  const current: Entry | null =
    (revisit ? kept.find((e) => e.id === revisit) : undefined) ??
    kept.find((e) => e.decision === 'undecided') ??
    null;
  const isRevealed = !!current && (revealed[current.id] === true || !!current.revealed_at);

  function reveal() {
    if (!current) return;
    setRevealed((r) => ({ ...r, [current.id]: true }));
    markRevealed(current.id).catch(() => {});
  }

  async function decide(decision: Decision) {
    if (!current || busy) return;
    const entry = current;
    setBusy(decision);
    setError(null);
    try {
      const res = await decideEntry(entry.id, decision);
      const mashId = res.mashId;
      if (decision === 'meet' && mashId) setMashIds((m) => ({ ...m, [entry.id]: mashId }));
      await qc.invalidateQueries({ queryKey: keys.batch(batch.id) });
      qc.invalidateQueries({ queryKey: keys.batches });
      qc.invalidateQueries({ queryKey: keys.mashes });
      setRevisit(null);
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setBusy(null);
    }
  }

  const header = (
    <Stack gap={spacing.sm}>
      <BackChevron />
      <Title>{copy.batch.arrival(mm, kept.length)}</Title>
    </Stack>
  );

  const thread = (
    <BatchThread
      batch={batch}
      me={me}
      label={`Notes with ${mm}`}
      placeholder={`Say something to ${mm}`}
    />
  );

  if (kept.length === 0) {
    return (
      <Screen>
        <Stack gap={spacing.xl}>
          <BackChevron />
          <Empty title="Nobody in this batch yet." body={copy.batch.waiting(mm)} />
          {thread}
        </Stack>
      </Screen>
    );
  }

  const decidedList =
    decided.length > 0 ? (
      <Stack gap={0}>
        {decided.map((e) => (
          <ListRow
            key={e.id}
            title={e.candidate.first_name}
            left={<Avatar uri={e.candidate.photo_url} name={e.candidate.first_name} size={40} />}
            right={<Pill text={decisionWord[e.decision]} />}
            onPress={e.decision === 'maybe' ? () => setRevisit(e.id) : undefined}
          />
        ))}
      </Stack>
    ) : null;

  // The end: what happened, not a score.
  if (!current) {
    const meets = decided.filter((e) => e.decision === 'meet');
    const maybes = decided.filter((e) => e.decision === 'maybe');
    return (
      <Screen>
        <Stack gap={spacing.xl}>
          {header}
          {decidedList}
          <Card>
            <Heading>That’s the batch.</Heading>
            {meets.map((e) => {
              const name = e.candidate.first_name;
              const mashId = mashIds[e.id];
              return (
                <Stack key={e.id} gap={spacing.xs}>
                  <Body>You said yes to {name}. We’ve asked them.</Body>
                  {mashId ? (
                    <Button
                      title={`Open ${name}`}
                      variant="ghost"
                      small
                      full={false}
                      onPress={() => router.push(`/mash/${mashId}`)}
                    />
                  ) : null}
                </Stack>
              );
            })}
            {maybes.length > 0 ? (
              <Caption>
                {maybes.map((e) => e.candidate.first_name).join(', ')}: maybe. Tap a name above to
                come back to it.
              </Caption>
            ) : null}
            {meets.length === 0 && maybes.length === 0 ? (
              <Body color={colors.textSecondary}>
                Nobody this time. The next batch lands when a Mashmaker picks someone.
              </Body>
            ) : null}
          </Card>
          {thread}
        </Stack>
      </Screen>
    );
  }

  const c = current.candidate;
  const name = c.first_name;
  const entryNotes = batch.comments.filter(
    (x) => x.entry_id === current.id && x.author_id === batch.mashmaker.id,
  );

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        {header}
        {decidedList}

        <Card style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Quote text={current.reason ?? `${mm} picked ${name} for you.`} by={`${mm} on ${name}`} />
          {entryNotes.map((n) => (
            <Quote key={n.id} text={n.text} by={mm} />
          ))}

          {!isRevealed ? (
            <View testID="show-me">
              <Button title="Show me" onPress={reveal} />
            </View>
          ) : (
            <Stack gap={spacing.lg} align="center">
              <Avatar uri={c.photo_url} name={name} size={160} />
              <Stack gap={spacing.xs} align="center">
                <Heading center>{name}</Heading>
                {c.city ? <Caption center>{c.city}</Caption> : null}
              </Stack>
              {c.bio ? (
                <Body center color={colors.textSecondary}>
                  {c.bio}
                </Body>
              ) : null}
              <Stack gap={spacing.xs} align="center">
                {c.verified_identity ? <Caption>Identity verified</Caption> : null}
                {c.photos_current ? <Caption>Photos checked current</Caption> : null}
              </Stack>
              <View style={{ alignSelf: 'stretch' }}>
                <Divider />
              </View>
              <Stack gap={spacing.sm} style={{ alignSelf: 'stretch' }}>
                {current.decision === 'maybe' ? <Caption center>You said maybe.</Caption> : null}
                <View testID="decide-meet">
                  <Button
                    title="Meet"
                    variant="accent"
                    onPress={() => decide('meet')}
                    loading={busy === 'meet'}
                    disabled={!!busy}
                  />
                </View>
                {current.decision !== 'maybe' ? (
                  <View testID="decide-maybe">
                    <Button
                      title="Maybe"
                      variant="secondary"
                      onPress={() => decide('maybe')}
                      loading={busy === 'maybe'}
                      disabled={!!busy}
                    />
                  </View>
                ) : null}
                <View testID="decide-pass">
                  <Button
                    title="Not this time"
                    variant="ghost"
                    onPress={() => decide('pass')}
                    loading={busy === 'pass'}
                    disabled={!!busy}
                  />
                </View>
                {revisit ? (
                  <Button
                    title="Leave it for now"
                    variant="ghost"
                    onPress={() => setRevisit(null)}
                    disabled={!!busy}
                  />
                ) : null}
                {error ? <Caption color={colors.danger}>{error}</Caption> : null}
              </Stack>
            </Stack>
          )}
        </Card>

        {thread}
      </Stack>
    </Screen>
  );
}
