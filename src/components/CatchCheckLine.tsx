// One verification line: a tick when it is done, "Not yet" when it is not. Never a number.

import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { Body, Caption, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';

export function CatchCheckLine({ label, done }: { label: string; done: boolean }) {
  return (
    <Stack row gap={spacing.sm} align="center">
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={done ? colors.accent : colors.textMuted}
        accessibilityLabel={done ? 'Done' : 'Not yet'}
      />
      <Body color={done ? colors.text : colors.textSecondary}>{label}</Body>
      {done ? null : <Caption>Not yet</Caption>}
    </Stack>
  );
}
