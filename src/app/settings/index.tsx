// Settings. Pause, re-sync, sign out and leave are all here and nowhere else.
// Leaving is one tap plus an inline confirm. Re-sync is a button, never automatic.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Body, Button, Caption, Card, Divider, ListRow, Screen, Stack } from '@/components/ui';
import { isEntitled, keys, useAppSettings } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { matchContacts } from '@/lib/api';
import { signOut } from '@/lib/auth';
import { allHashes, ensureContactsPermission, readHashedContacts } from '@/lib/contacts';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { exitDemo, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const LEAVE_COPY =
  'One tap and you’re gone from every Mashmaker and every open intro. Your Mashmakers get a thank-you, not the details.';

function Chevron() {
  return <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />;
}

export default function SettingsScreen() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const settings = useAppSettings();
  const qc = useQueryClient();

  const [pausing, setPausing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCatch = profile?.role === 'catch';
  const roleWord = isCatch ? 'Catch' : 'Mashmaker';
  const pauseNeedsPlus =
    isCatch && settings.data?.pause_requires_plus === 'true' && !isEntitled(profile);
  const version = Constants.expoConfig?.version ?? '0.0.0';

  const togglePause = async (paused: boolean) => {
    setPausing(true);
    setError(null);
    try {
      await updateProfile({ paused });
      if (paused) track(Events.paused);
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setPausing(false);
    }
  };

  const resync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const allowed = await ensureContactsPermission();
      if (!allowed) {
        setSyncMessage('Mash can’t read your contacts. Allow it in your phone’s settings first.');
        return;
      }
      const contacts = await readHashedContacts(profile?.country ?? 'NZ');
      const res = await matchContacts(allHashes(contacts), profile?.phone_hash ?? undefined);
      setSyncMessage(`${res.matched.length} matched`);
      qc.invalidateQueries({ queryKey: keys.connections });
    } catch {
      setSyncMessage(copy.errors.didNotSend);
    } finally {
      setSyncing(false);
    }
  };

  const onSignOut = async () => {
    try {
      if (DEMO) exitDemo();
      else await signOut();
    } finally {
      router.replace('/(auth)/welcome');
    }
  };

  const leave = async () => {
    setLeaving(true);
    setError(null);
    try {
      if (DEMO) {
        exitDemo();
      } else {
        const { error: rpcError } = await supabase.rpc('delete_my_account');
        if (rpcError) throw rpcError;
        await signOut();
      }
      track(Events.accountDeleted);
      router.replace('/(auth)/welcome');
    } catch {
      setError('That didn’t go through. Try again.');
      setLeaving(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={0}>
        <ListRow
          title="Profile"
          right={<Chevron />}
          onPress={() => router.push('/settings/profile')}
        />
        {isCatch ? (
          <ListRow
            title="What you’re after"
            right={<Chevron />}
            onPress={() => router.push('/settings/criteria')}
          />
        ) : null}
        {isCatch ? (
          <ListRow
            title="What your Mashmakers see"
            right={<Chevron />}
            onPress={() => router.push('/settings/visibility')}
          />
        ) : null}
        <ListRow
          title="The Machine’s checks"
          right={<Chevron />}
          onPress={() => router.push('/settings/checks')}
        />
        <ListRow
          title="People never to show me"
          right={<Chevron />}
          onPress={() => router.push('/settings/exclusions')}
        />
        {isCatch ? (
          <ListRow
            title="Mash Plus"
            subtitle={profile?.is_plus ? 'On' : undefined}
            right={<Chevron />}
            onPress={() => router.push('/settings/plus')}
          />
        ) : null}
        <ListRow
          title="What we promise"
          right={<Chevron />}
          onPress={() => router.push('/settings/promises')}
        />
        <ListRow
          title={`The ${roleWord} rules`}
          right={<Chevron />}
          onPress={() => router.push('/(onboarding)/rules')}
        />

        <Divider />

        <ListRow
          title="Pause"
          subtitle="Paused Catches aren’t put forward but keep their Mashmakers."
          onPress={pauseNeedsPlus ? () => router.push('/settings/plus') : undefined}
          right={
            pauseNeedsPlus ? (
              <Caption>Part of Mash Plus</Caption>
            ) : (
              <Switch
                value={!!profile?.paused}
                onValueChange={togglePause}
                disabled={pausing || !profile}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel="Pause"
              />
            )
          }
        />

        <Divider />

        <Stack gap={spacing.sm} style={{ paddingVertical: spacing.md }}>
          <Button
            title="Re-sync contacts"
            variant="secondary"
            onPress={resync}
            loading={syncing}
            accessibilityLabel="Re-sync contacts"
          />
          <Caption>Only when you tap this. Never on its own.</Caption>
          {syncMessage ? <Caption color={colors.text}>{syncMessage}</Caption> : null}
        </Stack>

        <Divider />

        <ListRow title="Sign out" onPress={onSignOut} />

        <Stack gap={spacing.sm} style={{ marginTop: spacing.lg }}>
          {confirmLeave ? (
            <Card tone="alt">
              <Body>{LEAVE_COPY}</Body>
              <Stack row gap={spacing.sm} align="center">
                <View style={{ flex: 1 }} testID="leave-mash">
                  <Button
                    title="Leave Mash"
                    variant="danger"
                    onPress={leave}
                    loading={leaving}
                    accessibilityLabel="Leave Mash for good"
                  />
                </View>
                <Button
                  title="Stay"
                  variant="ghost"
                  full={false}
                  onPress={() => setConfirmLeave(false)}
                  disabled={leaving}
                />
              </Stack>
            </Card>
          ) : (
            <Button title="Leave Mash" variant="danger" onPress={() => setConfirmLeave(true)} />
          )}
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        </Stack>

        <Caption style={{ marginTop: spacing.xxl }} center>
          Mash {version}
        </Caption>
      </Stack>
    </Screen>
  );
}
