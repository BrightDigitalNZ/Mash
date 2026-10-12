// You, as a Mashmaker. Who you are, the rules you agreed to, what has happened lately, and the
// door to Settings. Mashmakers never see pricing. There is nothing to pay for.

import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Body, Button, Caption, Card, Empty, ErrorView, Label, Loading, Screen, Stack, Title } from '@/components/ui';
import { useNotifications } from '@/hooks/useData';
import { markNotificationsRead } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { exitDemo, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { Notification } from '@/types/database';

/** "just now", "4 min ago", "3 hours ago", "yesterday", "5 days ago", else a short date. */
function relativeTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

function NotificationCard({ n }: { n: Notification }) {
  const route = typeof n.data?.route === 'string' ? n.data.route : null;
  const open = () => {
    if (!n.read) markNotificationsRead([n.id]).catch(() => {});
    if (route) router.push(route as never);
  };
  return (
    <Card
      tone={n.read ? 'surface' : 'highlight'}
      onPress={open}
      accessibilityLabel={n.body}
    >
      <Body>{n.body}</Body>
      <Caption>{relativeTime(n.created_at)}</Caption>
    </Card>
  );
}

export default function You() {
  const profile = useSession((s) => s.profile);
  const notifications = useNotifications();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';

  const doSignOut = async () => {
    setSigningOut(true);
    setError(null);
    try {
      if (DEMO) exitDemo();
      else await signOut();
      router.replace('/(auth)/welcome');
    } catch {
      setError('That didn’t work. Try again.');
      setSigningOut(false);
    }
  };

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack row align="center" gap={spacing.lg}>
          <Avatar uri={profile?.photo_url} name={profile?.first_name} size={72} />
          <View style={{ flex: 1 }}>
            <Title>{name || 'You'}</Title>
            {profile?.city ? <Body>{profile.city}</Body> : null}
            <Caption>Mashmaker</Caption>
          </View>
        </Stack>

        <Caption>Mashmakers are free. Always.</Caption>

        <Stack gap={spacing.sm}>
          <Button
            title="The Mashmaker rules"
            variant="secondary"
            onPress={() => router.push('/(onboarding)/rules')}
          />
          <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />
        </Stack>

        <Stack gap={spacing.sm}>
          <Label>Lately</Label>
          {notifications.isLoading ? (
            <Loading />
          ) : notifications.error ? (
            <ErrorView message={copy.errors.didNotLoad} onRetry={() => notifications.refetch()} />
          ) : (notifications.data ?? []).length === 0 ? (
            <Empty title="Quiet for now" body="When a Catch asks you, or a batch moves, you’ll hear about it here." />
          ) : (
            (notifications.data ?? []).map((n) => <NotificationCard key={n.id} n={n} />)
          )}
        </Stack>

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        <View testID="sign-out">
          <Button title="Sign out" variant="ghost" onPress={doSignOut} loading={signingOut} />
        </View>
      </Stack>
    </Screen>
  );
}
