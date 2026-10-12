// The conversation, once both have said yes. Opens with the Mashmaker's words.
// Mine on the right in black, theirs on the left in grey. The vouch sits in the middle.

import React from 'react';

import { Body, Caption, Card, Loading, Quote, Stack } from '@/components/ui';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';
import type { Message } from '@/types/database';

export default function MashChat({
  messages,
  me,
  loading,
}: {
  messages: Message[];
  me: string;
  loading: boolean;
}) {
  return (
    <Stack gap={spacing.md}>
      <Caption center>{copy.accept.bothYes}</Caption>
      {loading ? <Loading /> : null}
      {messages.map((m) => {
        if (m.is_vouch) return <Quote key={m.id} text={m.body} />;
        const mine = m.sender_id === me;
        return (
          <Card
            key={m.id}
            tone={mine ? 'inverse' : 'surface'}
            style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}
            accessibilityLabel={mine ? `You: ${m.body}` : m.body}
          >
            <Body color={mine ? colors.textInverse : colors.text}>{m.body}</Body>
          </Card>
        );
      })}
    </Stack>
  );
}
