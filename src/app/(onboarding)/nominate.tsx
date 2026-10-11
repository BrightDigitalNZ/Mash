// Last step for both roles. Invite the friends you would set up, in your own words.

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getCachedContacts, getCachedOnMashHashes, InviteFlow } from '@/components/ContactPicker';
import { Body, Button, Caption, Footer, Screen, Stack, Title } from '@/components/ui';
import { homeFor, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

export default function Nominate() {
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.session?.user.id);
  const updateProfile = useSession((s) => s.updateProfile);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contacts = getCachedContacts();
  const excludeHashes = [
    ...(profile?.phone_hash ? [profile.phone_hash] : []),
    ...getCachedOnMashHashes(),
  ];

  async function finish() {
    if (finishing) return;
    setFinishing(true);
    setError(null);
    try {
      const updated = await updateProfile({ onboarding_complete: true });
      router.replace(homeFor(updated) as never);
    } catch {
      setError('That did not save. Check your connection and try again.');
      setFinishing(false);
    }
  }

  if (!userId || !profile) {
    return (
      <Screen>
        <Caption>Loading your profile...</Caption>
      </Screen>
    );
  }

  if (contacts.length === 0) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Stack gap={spacing.lg}>
            <Title>Who would you set up?</Title>
            <Body color={colors.textSecondary}>
              Inviting friends needs your contacts, and Mash does not have them yet. You can go back
              and allow contacts, or do this later from the invite button.
            </Body>
          </Stack>
        </View>
        <Footer>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button
            title="Go back to contacts"
            variant="secondary"
            onPress={() => router.replace('/(onboarding)/contacts')}
            disabled={finishing}
          />
          <Button title="Skip for now" onPress={finish} loading={finishing} />
        </Footer>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <View
        style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md }}
      >
        <Stack gap={spacing.sm}>
          <Title>Who would you set up?</Title>
          <Body color={colors.textSecondary}>
            Tap friends you think are single and want to help. Mash sends them an invite from you,
            in your words.
          </Body>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        </Stack>
      </View>
      <InviteFlow
        contacts={contacts}
        excludeHashes={excludeHashes}
        voucherId={userId}
        voucherFirstName={profile.first_name}
        onDone={finish}
        onSkip={finish}
        skipLabel="Not now"
      />
    </Screen>
  );
}
