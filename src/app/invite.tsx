// Invite a friend, any time after onboarding. Presented as a modal from the root stack.

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  getCachedContacts,
  getCachedOnMashHashes,
  InviteFlow,
  setCachedContacts,
} from '@/components/ContactPicker';
import { Body, Button, Caption, Footer, Loading, Screen, Stack, Title } from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { ensureContactsPermission, readHashedContacts } from '@/lib/contacts';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type State = { kind: 'loading' } | { kind: 'ready' } | { kind: 'denied' } | { kind: 'error' };

export default function Invite() {
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.session?.user.id);
  const [state, setState] = useState<State>(() =>
    getCachedContacts().length > 0 ? { kind: 'ready' } : { kind: 'loading' },
  );
  const [sentCount, setSentCount] = useState<number | null>(null);

  const country = profile?.country ?? 'NZ';

  useEffect(() => {
    if (state.kind !== 'loading') return;
    let alive = true;
    (async () => {
      try {
        const granted = await ensureContactsPermission();
        if (!granted) {
          track(Events.contactsDeclined);
          if (alive) setState({ kind: 'denied' });
          return;
        }
        track(Events.contactsGranted);
        const contacts = await readHashedContacts(country);
        setCachedContacts(contacts);
        if (alive) setState({ kind: 'ready' });
      } catch {
        if (alive) setState({ kind: 'error' });
      }
    })();
    return () => {
      alive = false;
    };
  }, [state.kind, country]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const header = (
    <View
      style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md }}
    >
      <Stack gap={spacing.sm}>
        <Title>Invite a friend</Title>
        <Body color={colors.textSecondary}>
          Tap friends you think are single and want to help. Mash sends them an invite from you, in
          your words.
        </Body>
      </Stack>
    </View>
  );

  if (!userId || !profile) {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <Loading />
      </Screen>
    );
  }

  if (state.kind === 'loading') {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <Loading label="Hashing on your phone..." />
      </Screen>
    );
  }

  if (state.kind === 'denied' || state.kind === 'error') {
    return (
      <Screen scroll={false} padded={false}>
        {header}
        <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
          <Caption>
            {state.kind === 'denied'
              ? 'Mash needs your contacts to send an invite. You can allow it in Settings, or share Mash from your own messages.'
              : 'Reading your contacts did not work. Try again in a moment.'}
          </Caption>
        </View>
        <Footer>
          {state.kind === 'error' ? (
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => setState({ kind: 'loading' })}
            />
          ) : null}
          <Button title="Close" onPress={close} />
        </Footer>
      </Screen>
    );
  }

  if (sentCount !== null) {
    return (
      <Screen scroll={false} padded={false}>
        <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
          <Stack gap={spacing.sm}>
            <Title>
              {sentCount === 0
                ? 'No invites sent'
                : sentCount === 1
                  ? 'One invite sent'
                  : `${sentCount} invites sent`}
            </Title>
            <Body color={colors.textSecondary}>
              {sentCount === 0
                ? 'Nothing went out. Come back whenever you are ready.'
                : 'When they join, they land in your circle and you can vouch for them.'}
            </Body>
          </Stack>
        </View>
        <Footer>
          <Button title="Done" onPress={close} />
        </Footer>
      </Screen>
    );
  }

  const excludeHashes = [
    ...(profile.phone_hash ? [profile.phone_hash] : []),
    ...getCachedOnMashHashes(),
  ];

  return (
    <Screen scroll={false} padded={false}>
      {header}
      <InviteFlow
        contacts={getCachedContacts()}
        excludeHashes={excludeHashes}
        voucherId={userId}
        voucherFirstName={profile.first_name}
        onDone={(n) => setSentCount(n)}
        onSkip={close}
        skipLabel="Cancel"
      />
    </Screen>
  );
}
