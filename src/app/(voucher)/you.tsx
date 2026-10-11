import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorView,
  Label,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { useNotifications } from '@/hooks/useData';
import { markNotificationsRead } from '@/lib/api';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** "just now", "4 min ago", "3 hours ago", "yesterday", "5 days ago", else a short date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
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

export default function You() {
  const profile = useSession((s) => s.profile);
  const notifications = useNotifications();

  const unreadIds = (notifications.data ?? []).filter((n) => !n.read).map((n) => n.id);
  const unreadKey = unreadIds.join(',');

  useEffect(() => {
    if (!unreadKey) return;
    markNotificationsRead(unreadKey.split(',')).catch(() => {});
  }, [unreadKey]);

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack row align="center" gap={spacing.lg}>
          <Avatar uri={profile?.photo_url} name={profile?.first_name} size={72} />
          <View style={{ flex: 1 }}>
            <Title>
              {profile?.first_name} {profile?.last_name}
            </Title>
            {profile?.city ? <Body>{profile.city}</Body> : null}
            <Caption>Voucher</Caption>
          </View>
        </Stack>

        <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />

        <Stack gap={spacing.sm}>
          <Label>Activity</Label>
          {notifications.isLoading ? (
            <Loading />
          ) : notifications.error ? (
            <ErrorView
              message="Could not load your activity."
              onRetry={() => notifications.refetch()}
            />
          ) : (notifications.data ?? []).length === 0 ? (
            <Empty
              title="Quiet for now"
              body="When a friend joins or a lineup moves, you'll hear about it here."
            />
          ) : (
            (notifications.data ?? []).map((n) => {
              const route = typeof n.data?.route === 'string' ? n.data.route : null;
              return (
                <Card
                  key={n.id}
                  tone={n.read ? 'surface' : 'highlight'}
                  onPress={route ? () => router.push(route as never) : undefined}
                >
                  <Body>{n.body}</Body>
                  <Caption>{relativeTime(n.created_at)}</Caption>
                </Card>
              );
            })
          )}
        </Stack>
      </Stack>
    </Screen>
  );
}
