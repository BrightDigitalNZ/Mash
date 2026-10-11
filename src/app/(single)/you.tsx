// You. Who you are on Mash, the door to Settings, and what has happened lately.

import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Avatar, Body, Button, Caption, Card, Empty, ErrorView, Heading, Loading, Screen, Stack, Title } from '@/components/ui';
import { useNotifications } from '@/hooks/useData';
import { markNotificationsRead } from '@/lib/api';
import { useSession } from '@/store/session';
import { spacing } from '@/theme';

/** "just now", "5m ago", "2h ago", "3d ago", then a date. */
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export default function YouScreen() {
  const profile = useSession((s) => s.profile);
  const notes = useNotifications();

  // Remember which rows were unread when I arrived, so they stay highlighted for this visit
  // even after we tell the server they have been seen.
  const [arrivedUnread, setArrivedUnread] = useState<Set<string>>(new Set());
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !notes.data) return;
    marked.current = true;
    const unread = notes.data.filter((n) => !n.read).map((n) => n.id);
    setArrivedUnread(new Set(unread));
    markNotificationsRead(unread).catch(() => {});
  }, [notes.data]);

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';
  const role = profile?.role === 'voucher' ? 'Vouching for friends' : 'Single';

  let activity: React.ReactNode;
  if (notes.isLoading) {
    activity = <Loading />;
  } else if (notes.isError) {
    activity = <ErrorView message="Your activity didn't load." onRetry={() => notes.refetch()} />;
  } else if ((notes.data ?? []).length === 0) {
    activity = <Empty title="Nothing yet" body="When a friend vouches, nominates or writes, it shows up here." />;
  } else {
    activity = (
      <Stack gap={spacing.sm}>
        {(notes.data ?? []).map((n) => {
          const route = typeof n.data.route === 'string' ? n.data.route : null;
          const fresh = arrivedUnread.has(n.id) || !n.read;
          return (
            <Card
              key={n.id}
              tone={fresh ? 'highlight' : 'surface'}
              onPress={route ? () => router.push(route as never) : undefined}
            >
              <Body>{n.body}</Body>
              <Caption>{timeAgo(n.created_at)}</Caption>
            </Card>
          );
        })}
      </Stack>
    );
  }

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack row gap={spacing.lg} align="center">
          <Avatar uri={profile?.photo_url} name={profile?.first_name} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <Title>{name || 'You'}</Title>
            {profile?.city ? <Body>{profile.city}</Body> : null}
            <Caption>{role}</Caption>
          </View>
        </Stack>

        <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />

        <Stack gap={spacing.md}>
          <Heading>Activity</Heading>
          {activity}
        </Stack>
      </Stack>
    </Screen>
  );
}
