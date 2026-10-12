// Two doors. A Catch is someone single, looking. A Mashmaker is the friend who knows someone.

import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Caption, Card, Heading, Screen, Stack, Title } from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { copy } from '@/lib/copy';
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
      router.replace('/(onboarding)/rules');
    } catch {
      setError(copy.errors.didNotSave);
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
          <Title>Which one are you?</Title>
          <Body color={colors.textSecondary}>You can change this later.</Body>
        </Stack>

        <Card
          onPress={() => pick('catch')}
          testID="pick-catch"
          accessibilityLabel="I’m a Catch. Single, looking. Your friends do the matching."
          accessibilityState={{ selected: current === 'catch', busy: busy === 'catch' }}
          tone={current === 'catch' ? 'highlight' : 'surface'}
          style={{ padding: spacing.xl, gap: spacing.sm }}
        >
          <Heading>I’m a Catch</Heading>
          <Body color={colors.textSecondary}>
            Single, looking. Your friends do the matching, and nobody sees you who they haven’t
            vouched for.
          </Body>
        </Card>

        <Card
          onPress={() => pick('mashmaker')}
          testID="pick-mashmaker"
          accessibilityLabel="I’m a Mashmaker. The friend who knows someone. Free forever."
          accessibilityState={{ selected: current === 'mashmaker', busy: busy === 'mashmaker' }}
          tone={current === 'mashmaker' ? 'highlight' : 'surface'}
          style={{ padding: spacing.xl, gap: spacing.sm }}
        >
          <Heading>I’m a Mashmaker</Heading>
          <Body color={colors.textSecondary}>
            The friend who knows someone. You introduce people you actually know. Free forever.
          </Body>
        </Card>

        {busy ? <Caption center>Saving.</Caption> : null}
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
