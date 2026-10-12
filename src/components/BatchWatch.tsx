// The Mashmaker's side of a batch: watching. Status only, never a reason. One bring-back.
// A nomination can be withdrawn quietly; nobody is told why.

import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import BackChevron from '@/components/BackChevron';
import BatchThread from '@/components/BatchThread';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Label,
  ListRow,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, type BatchWithPeople } from '@/hooks/useData';
import { overrideDrop, withdrawNomination } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, radius, spacing } from '@/theme';

type Entry = BatchWithPeople['entries'][number];

function statusText(e: Entry, catchName: string): string {
  if (e.consent === 'pending') return 'Asked';
  if (e.consent === 'no') return 'Said no';
  switch (e.decision) {
    case 'meet':
      return `${catchName} said yes`;
    case 'maybe':
      return `${catchName} said maybe`;
    case 'pass':
      return 'Didn’t go ahead';
    default:
      return 'In the batch';
  }
}

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

export default function BatchWatch({ batch, me }: { batch: BatchWithPeople; me: string }) {
  const qc = useQueryClient();
  const catchName = batch.catch.first_name;
  const kept = batch.entries.filter((e) => e.kept);
  const dropped = batch.entries.filter((e) => !e.kept);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [bringing, setBringing] = useState<string | null>(null);
  const [broughtBack, setBroughtBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canBringBack = !broughtBack && !batch.entries.some((e) => e.mashmaker_overrode);

  function invalidate() {
    qc.invalidateQueries({ queryKey: keys.batch(batch.id) });
    qc.invalidateQueries({ queryKey: keys.batches });
    qc.invalidateQueries({ queryKey: keys.mashes });
  }

  async function withdraw(entryId: string) {
    if (withdrawing) return;
    setWithdrawing(entryId);
    setError(null);
    try {
      await withdrawNomination(entryId);
      setConfirming(null);
      invalidate();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setWithdrawing(null);
    }
  }

  async function bringBack(entryId: string) {
    if (bringing || !canBringBack) return;
    setBringing(entryId);
    setError(null);
    try {
      await overrideDrop(entryId);
      setBroughtBack(true);
      invalidate();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setBringing(null);
    }
  }

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.sm}>
          <BackChevron />
          <Title>Your batch for {catchName}</Title>
        </Stack>

        {batch.machine_note ? (
          <Card tone="alt">
            <Label>The Machine</Label>
            <Body>{batch.machine_note}</Body>
          </Card>
        ) : null}

        <Stack gap={spacing.sm}>
          <Heading>In the batch</Heading>
          {kept.length === 0 ? <Caption>Nobody is in this batch.</Caption> : null}
          {kept.map((e) => {
            const name = e.candidate.first_name;
            const open = expanded === e.id;
            const canWithdraw = e.decision === 'undecided' && e.consent !== 'no';
            return (
              <View key={e.id}>
                <ListRow
                  title={name}
                  subtitle={e.mashmaker_overrode ? 'You brought them back' : undefined}
                  left={<Avatar uri={e.candidate.photo_url} name={name} size={44} />}
                  right={<Pill text={statusText(e, catchName)} />}
                  onPress={() => setExpanded(open ? null : e.id)}
                />
                {open ? (
                  <Card tone="alt" style={{ marginBottom: spacing.sm, gap: spacing.md }}>
                    <BatchThread
                      batch={batch}
                      me={me}
                      entryId={e.id}
                      placeholder={`One line about ${name}, for ${catchName}`}
                    />
                    {canWithdraw && confirming !== e.id ? (
                      <Button
                        title="Withdraw"
                        variant="ghost"
                        small
                        full={false}
                        onPress={() => setConfirming(e.id)}
                        accessibilityLabel={`Withdraw ${name}`}
                      />
                    ) : null}
                    {canWithdraw && confirming === e.id ? (
                      <Stack gap={spacing.sm}>
                        <Caption>Nobody will be told why.</Caption>
                        <Stack row gap={spacing.sm}>
                          <View testID={`withdraw-${e.id}`}>
                            <Button
                              title={`Withdraw ${name}`}
                              variant="danger"
                              small
                              full={false}
                              loading={withdrawing === e.id}
                              disabled={!!withdrawing}
                              onPress={() => withdraw(e.id)}
                            />
                          </View>
                          <Button
                            title="Keep"
                            variant="ghost"
                            small
                            full={false}
                            disabled={!!withdrawing}
                            onPress={() => setConfirming(null)}
                          />
                        </Stack>
                      </Stack>
                    ) : null}
                  </Card>
                ) : null}
              </View>
            );
          })}
        </Stack>

        {dropped.length > 0 ? (
          <Stack gap={spacing.sm}>
            <Label>Set aside</Label>
            <Caption>
              {canBringBack
                ? 'You can bring one person back. They are asked like anyone else.'
                : 'You have used your one bring-back for this batch.'}
            </Caption>
            {dropped.map((e) => {
              const name = e.candidate.first_name;
              const withdrawn = e.dropped_reason?.startsWith('Withdrawn') ?? false;
              return (
                <ListRow
                  key={e.id}
                  title={name}
                  subtitle={e.dropped_reason ?? undefined}
                  left={<Avatar uri={e.candidate.photo_url} name={name} size={36} />}
                  right={
                    canBringBack && !withdrawn ? (
                      <View testID={`bring-back-${e.id}`}>
                        <Button
                          title="Bring back"
                          variant="secondary"
                          small
                          full={false}
                          loading={bringing === e.id}
                          disabled={!!bringing}
                          onPress={() => bringBack(e.id)}
                          accessibilityLabel={`Bring back ${name}`}
                        />
                      </View>
                    ) : undefined
                  }
                />
              );
            })}
          </Stack>
        ) : null}

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}

        <BatchThread
          batch={batch}
          me={me}
          label={`Notes with ${catchName}`}
          placeholder={`${catchName} sees this at the top`}
        />

        <Caption>You’ll know whether it went ahead. How it goes is theirs to tell you.</Caption>
      </Stack>
    </Screen>
  );
}
