// What a Catch's Mashmakers are told. The default is almost nothing, and the Catch chooses again
// every time they report how a date went.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';

import { Body, Caption, Card, Heading, Screen, Stack } from '@/components/ui';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { VisibilityLevel } from '@/types/database';

const OPTIONS: { value: VisibilityLevel; title: string; body: string }[] = [
  {
    value: 'minimal',
    title: 'Almost nothing',
    body: 'They know who was introduced and whether it went ahead.',
  },
  {
    value: 'updates',
    title: 'Updates',
    body: 'They also see what you choose to share after a date.',
  },
];

export default function VisibilityScreen() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const [saving, setSaving] = useState<VisibilityLevel | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = profile?.mashmaker_visibility ?? 'minimal';

  const choose = async (value: VisibilityLevel) => {
    if (saving || value === current) return;
    setSaving(value);
    setError(null);
    try {
      await updateProfile({ mashmaker_visibility: value });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.lg}>
        <Body color={colors.textSecondary}>
          Your Mashmakers never see a conversation, a brief, or a reason. This is the most they can
          know.
        </Body>
        {OPTIONS.map((o) => {
          const selected = o.value === current;
          return (
            <Card
              key={o.value}
              onPress={() => choose(o.value)}
              tone={selected ? 'highlight' : 'surface'}
              style={{ borderWidth: 2, borderColor: selected ? colors.primary : 'transparent' }}
              accessibilityLabel={o.title}
              accessibilityState={{ selected, busy: saving === o.value }}
            >
              <Stack row align="center" justify="space-between" gap={spacing.md}>
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Heading>{o.title}</Heading>
                  <Body color={colors.textSecondary}>{o.body}</Body>
                </Stack>
                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={26}
                  color={selected ? colors.primary : colors.textMuted}
                />
              </Stack>
            </Card>
          );
        })}
        <Caption>You decide again every time you report how it went.</Caption>
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
      </Stack>
    </Screen>
  );
}
