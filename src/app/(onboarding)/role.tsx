// Two doors. You can be both over time, but you start as one.

import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Caption, Card, Heading, Screen, Stack, Title } from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { UserRole } from '@/types/database';

export default function Role() {
  const updateProfile = useSession((s) => s.updateProfile);
  const current = useSession((s) => s.profile?.role ?? null);
  const [busy, setBusy] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(role: UserRole) {
    if (busy) return;
    setBusy(role);
    setError(null);
    try {
      await updateProfile({ role });
      track(Events.rolePicked, { role });
      router.replace(role === 'single' ? '/(onboarding)/criteria' : '/(onboarding)/contacts');
    } catch {
      setError('That did not save. Check your connection and try again.');
      setBusy(null);
    }
  }

  function back() {
    if (router.canGoBack()) router.back();
    else router.replace('/(onboarding)/about');
  }

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.sm}>
          <Title>How do you want to use Mash?</Title>
          <Body color={colors.textSecondary}>You can change this later.</Body>
        </Stack>

        <Card
          onPress={() => pick('single')}
          accessibilityLabel="I'm single. Friends vouch for you. The matchmaker does the rest."
          accessibilityState={{ selected: current === 'single', busy: busy === 'single' }}
          tone={current === 'single' ? 'highlight' : 'surface'}
          style={{ padding: spacing.xl, gap: spacing.sm }}
        >
          <Heading>I&apos;m single</Heading>
          <Body color={colors.textSecondary}>
            Friends vouch for you. The matchmaker does the rest.
          </Body>
        </Card>

        <Card
          onPress={() => pick('voucher')}
          accessibilityLabel="I'm here to help. Set up your single friends. Taken or single, you're the matchmaker."
          accessibilityState={{ selected: current === 'voucher', busy: busy === 'voucher' }}
          tone={current === 'voucher' ? 'highlight' : 'surface'}
          style={{ padding: spacing.xl, gap: spacing.sm }}
        >
          <Heading>I&apos;m here to help</Heading>
          <Body color={colors.textSecondary}>
            Set up your single friends. Taken or single, you&apos;re the matchmaker.
          </Body>
        </Card>

        {busy ? <Caption center>Saving...</Caption> : null}
        {error ? (
          <Caption color={colors.danger} center>
            {error}
          </Caption>
        ) : null}

        <Button title="Back" variant="ghost" onPress={back} disabled={!!busy} />
      </Stack>
    </Screen>
  );
}
