// Comments on a batch, between the Catch and the Mashmaker. One thread for the batch
// (entryId null) or one for one entry. Plain rows, a field, a Send.

import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Field, Label, Stack } from '@/components/ui';
import { keys, type BatchWithPeople } from '@/hooks/useData';
import { commentOnBatch } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export default function BatchThread({
  batch,
  me,
  entryId = null,
  label,
  placeholder,
}: {
  batch: BatchWithPeople;
  me: string;
  entryId?: string | null;
  label?: string;
  placeholder: string;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const comments = batch.comments.filter((c) => c.entry_id === entryId);

  function nameOf(authorId: string): string {
    if (authorId === me) return 'You';
    if (authorId === batch.mashmaker.id) return batch.mashmaker.first_name;
    return batch.catch.first_name;
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      await commentOnBatch({ batchId: batch.id, entryId, authorId: me, text: trimmed });
      setText('');
      qc.invalidateQueries({ queryKey: keys.batch(batch.id) });
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setSending(false);
    }
  }

  return (
    <Stack gap={spacing.sm}>
      {label ? <Label>{label}</Label> : null}
      {comments.map((c) => (
        <View key={c.id} style={{ gap: 2 }}>
          <Caption>
            {nameOf(c.author_id)}, {when(c.created_at)}
          </Caption>
          <Body>{c.text}</Body>
        </View>
      ))}
      <Stack row gap={spacing.sm} align="flex-end">
        <Field
          style={{ flex: 1 }}
          placeholder={placeholder}
          value={text}
          onChangeText={setText}
          maxLength={300}
          multiline
          accessibilityLabel={placeholder}
        />
        <View testID={entryId ? `send-comment-${entryId}` : 'send-comment'}>
          <Button
            title="Send"
            small
            full={false}
            loading={sending}
            disabled={!text.trim()}
            onPress={send}
          />
        </View>
      </Stack>
      {error ? <Caption color={colors.danger}>{error}</Caption> : null}
    </Stack>
  );
}
