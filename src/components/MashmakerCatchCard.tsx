// One accepted Catch on the Mashmaker's home. The note first, then the batch, then their batches.

import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Button, Caption, Card, Heading, ListRow, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { Batch, MyCatchRow } from '@/types/database';

export type CatchBatch = Pick<Batch, 'id' | 'status' | 'created_at'>;

/** Plain words for where a batch is. */
function batchLine(b: CatchBatch, name: string): string {
  switch (b.status) {
    case 'building':
      return 'The Machine is reading it.';
    case 'consenting':
      return 'Asking each person.';
    case 'ready':
      return `Ready. ${name} is looking.`;
    case 'done':
      return 'Done.';
    default:
      return '';
  }
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export default function MashmakerCatchCard({ row, batches }: { row: MyCatchRow; batches: CatchBatch[] }) {
  const [showBatches, setShowBatches] = useState(false);
  const name = row.first_name;
  const id = row.catch_id;

  return (
    <Card>
      <Stack row align="center" gap={spacing.md}>
        <Avatar uri={row.photo_url} name={name} size={56} />
        <View style={{ flex: 1 }}>
          <Heading>{name}</Heading>
          {row.city ? <Caption>{row.city}</Caption> : null}
        </View>
      </Stack>

      {row.has_vouch ? (
        <Stack row align="center" justify="space-between" gap={spacing.sm}>
          <Caption>Your note is in.</Caption>
          <Button
            title="Edit"
            variant="ghost"
            small
            full={false}
            accessibilityLabel={`Edit your note about ${name}`}
            onPress={() => router.push(`/vouch/${id}`)}
          />
        </Stack>
      ) : (
        <Stack gap={spacing.sm}>
          <Caption>A line about {name} is the first thing a Catch will read.</Caption>
          <Button
            title="Write your note"
            variant="secondary"
            accessibilityLabel={`Write your note about ${name}`}
            onPress={() => router.push(`/vouch/${id}`)}
          />
        </Stack>
      )}

      <View testID={`nominate-${id}`}>
        {row.open_batch ? (
          <Stack gap={spacing.xs}>
            <Button title={`Pick people for ${name}`} disabled />
            <Caption>A batch is open. The next one can go once it resolves.</Caption>
          </Stack>
        ) : (
          <Stack gap={spacing.xs}>
            <Button
              title={`Pick people for ${name}`}
              disabled={!row.has_vouch}
              onPress={() => router.push(`/nominate/${id}`)}
            />
            {!row.has_vouch ? <Caption>Write your note first.</Caption> : null}
          </Stack>
        )}
      </View>

      {batches.length > 0 ? (
        <Stack gap={0}>
          <Pressable
            onPress={() => setShowBatches((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showBatches ? `Hide ${name}’s batches` : `Show ${name}’s batches`}
            accessibilityState={{ expanded: showBatches }}
            hitSlop={8}
            style={({ pressed }) => [{ paddingVertical: spacing.xs }, pressed && { opacity: 0.7 }]}
          >
            <Caption color={colors.primary}>{showBatches ? 'Hide their batches' : 'Their batches'}</Caption>
          </Pressable>
          {showBatches
            ? batches.map((b) => (
                <ListRow
                  key={b.id}
                  title={`Batch, ${shortDate(b.created_at)}`}
                  subtitle={batchLine(b, name)}
                  onPress={() => router.push(`/batch/${b.id}`)}
                />
              ))
            : null}
        </Stack>
      ) : null}
    </Card>
  );
}
