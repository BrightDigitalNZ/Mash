import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Switch } from 'react-native';

import { Button, Caption, Divider, ListRow, Screen, Stack } from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { deleteAccount, signOut } from '@/lib/auth';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const PRIVACY_URL = 'https://mash.dating/privacy';
const TERMS_URL = 'https://mash.dating/terms';

function Chevron() {
  return <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />;
}

export default function Settings() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const [pausing, setPausing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSingle = profile?.role === 'single';
  const version = Constants.expoConfig?.version ?? '0.0.0';

  const togglePause = async (paused: boolean) => {
    setPausing(true);
    setError(null);
    try {
      await updateProfile({ paused });
      if (paused) track(Events.paused);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that.');
    } finally {
      setPausing(false);
    }
  };

  const onSignOut = async () => {
    try {
      await signOut();
    } finally {
      router.replace('/');
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This removes your profile, your vouches and your introductions. It cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
              track(Events.accountDeleted);
              router.replace('/');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete your account.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Stack gap={0}>
        <ListRow
          title="Profile"
          right={<Chevron />}
          onPress={() => router.push('/settings/profile')}
        />
        {isSingle ? (
          <ListRow
            title="What you're after"
            right={<Chevron />}
            onPress={() => router.push('/settings/criteria')}
          />
        ) : null}
        <ListRow
          title="Linked profiles and brief"
          right={<Chevron />}
          onPress={() => router.push('/settings/linked')}
        />
        <ListRow
          title="Mash Plus"
          subtitle={profile?.is_plus ? 'Active' : undefined}
          right={<Chevron />}
          onPress={() => router.push('/settings/plus')}
        />

        <Divider />

        <ListRow
          title="Pause Mash"
          subtitle="Paused: you won't appear on lineups. Your circle stays."
          right={
            <Switch
              value={!!profile?.paused}
              onValueChange={togglePause}
              disabled={pausing || !profile}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Pause Mash"
            />
          }
        />

        <Divider />

        <ListRow
          title="Privacy policy"
          right={<Chevron />}
          onPress={() => Linking.openURL(PRIVACY_URL)}
        />
        <ListRow title="Terms" right={<Chevron />} onPress={() => Linking.openURL(TERMS_URL)} />

        <Divider />

        <ListRow title="Sign out" onPress={onSignOut} />

        <Stack gap={spacing.xs} style={{ marginTop: spacing.lg }}>
          <Button title="Delete account" variant="danger" onPress={onDelete} />
          <Caption center>Permanent. Everything about you is removed.</Caption>
        </Stack>

        {error ? (
          <Caption color={colors.danger} style={{ marginTop: spacing.md }}>
            {error}
          </Caption>
        ) : null}

        <Caption style={{ marginTop: spacing.xxl }} center>
          Mash {version}
        </Caption>
      </Stack>
    </Screen>
  );
}
