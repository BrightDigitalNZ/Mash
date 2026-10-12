// You. Who you are on Mash, what your Mashmakers see, and what has happened lately.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { CatchCheckLine } from '@/components/CatchCheckLine';
import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Empty,
  ErrorView,
  Heading,
  ListRow,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { useNotifications } from '@/hooks/useData';
import { markNotificationsRead } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { exitDemo, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

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

function Chevron() {
  return <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />;
}

export default function YouScreen() {
  const profile = useSession((s) => s.profile);
  const notes = useNotifications();
  const [signingOut, setSigningOut] = useState(false);

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

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (DEMO) exitDemo();
      else await signOut();
    } finally {
      setSigningOut(false);
      router.replace('/(auth)/welcome');
    }
  }

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : '';
  const sees = profile?.mashmaker_visibility === 'updates' ? 'Updates' : 'Almost nothing';

  let activity: React.ReactNode;
  if (notes.isLoading) {
    activity = <Loading />;
  } else if (notes.isError) {
    activity = <ErrorView message={copy.errors.didNotLoad} onRetry={() => notes.refetch()} />;
  } else if ((notes.data ?? []).length === 0) {
    activity = (
      <Empty
        title="Nothing yet"
        body="When a Mashmaker picks someone, or someone says yes, it shows up here."
      />
    );
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
              accessibilityLabel={n.body}
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
        <Stack gap={spacing.md} align="center">
          <Avatar uri={profile?.photo_url} name={profile?.first_name} size={112} />
          <Stack gap={2} align="center">
            <Title center>{name || 'You'}</Title>
            {profile?.city ? <Body color={colors.textSecondary}>{profile.city}</Body> : null}
          </Stack>
          {profile?.bio ? (
            <Body center color={colors.textSecondary}>
              {profile.bio}
            </Body>
          ) : null}
        </Stack>

        <Card>
          <CatchCheckLine label="Identity verified" done={!!profile?.verified_identity} />
          <CatchCheckLine label="Photos checked current" done={!!profile?.photos_current} />
        </Card>

        <ListRow
          title="What your Mashmakers see"
          subtitle={sees}
          right={<Chevron />}
          onPress={() => router.push('/settings/visibility')}
        />

        <Stack gap={spacing.sm}>
          <Button title="Settings" variant="secondary" onPress={() => router.push('/settings')} />
          <View testID="sign-out">
            <Button title="Sign out" variant="ghost" onPress={onSignOut} loading={signingOut} />
          </View>
        </Stack>

        <Stack gap={spacing.md}>
          <Heading>Lately</Heading>
          {activity}
        </Stack>
      </Stack>
    </Screen>
  );
}
