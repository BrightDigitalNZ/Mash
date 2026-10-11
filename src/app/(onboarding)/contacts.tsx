// The privacy-critical step. Contacts are read on the phone, hashed on the phone, and only the
// hashes go up. The app works without this; the App Store and our own promise both require it.

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { setCachedContacts, setCachedOnMashHashes } from '@/components/ContactPicker';
import {
  Body,
  Button,
  Caption,
  Card,
  FaceRow,
  Field,
  Footer,
  Heading,
  Loading,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { matchContacts, type MatchContactsResult } from '@/lib/api';
import {
  allHashes,
  ensureContactsPermission,
  hashPhone,
  normalisePhone,
  readHashedContacts,
} from '@/lib/contacts';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type Stage =
  | { kind: 'ask' }
  | { kind: 'declined' }
  | { kind: 'phone' }
  | { kind: 'hashing' }
  | { kind: 'matching' }
  | { kind: 'result'; result: MatchContactsResult; contacts: number }
  | { kind: 'error'; message: string };

const NEXT = '/(onboarding)/nominate';

export default function Contacts() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const country = profile?.country ?? 'NZ';

  const [stage, setStage] = useState<Stage>({ kind: 'ask' });
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function allow() {
    if (asking) return;
    setAsking(true);
    try {
      const granted = await ensureContactsPermission();
      if (granted) {
        track(Events.contactsGranted);
        setStage({ kind: 'phone' });
      } else {
        track(Events.contactsDeclined);
        setStage({ kind: 'declined' });
      }
    } catch {
      track(Events.contactsDeclined);
      setStage({ kind: 'declined' });
    } finally {
      setAsking(false);
    }
  }

  async function find() {
    const normalised = normalisePhone(phone, country);
    if (!normalised) {
      setPhoneError('That does not look like a mobile number.');
      return;
    }
    setPhoneError(null);
    try {
      setStage({ kind: 'hashing' });
      const myHash = await hashPhone(normalised);
      const contacts = await readHashedContacts(country);
      setCachedContacts(contacts);
      const hashes = allHashes(contacts);
      setStage({ kind: 'matching' });
      const result = await matchContacts(hashes, myHash);
      setCachedOnMashHashes(result.matched.map((m) => m.hash).filter((h): h is string => !!h));
      // phone_hash is now set server-side; pull it into the store.
      refreshProfile().catch(() => {});
      setStage({ kind: 'result', result, contacts: contacts.length });
    } catch {
      setStage({
        kind: 'error',
        message: 'Looking for your people did not work. Check your connection and try again.',
      });
    }
  }

  function next() {
    router.replace(NEXT);
  }

  // --- stages ---------------------------------------------------------------

  if (stage.kind === 'ask' || stage.kind === 'declined') {
    return (
      <Screen scroll={false} padded={false}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Stack gap={spacing.lg}>
            <Title>Find your people</Title>
            <Body color={colors.textSecondary}>
              Mash reads your contacts to find friends already here. Numbers are hashed on your
              phone before anything leaves it. Mash never stores your contact list.
            </Body>
            <Card tone="alt">
              <Caption>What a hash is</Caption>
              <Body>
                A one-way scramble of the number. We can tell two people have the same number
                without ever knowing what it is.
              </Body>
            </Card>
            {stage.kind === 'declined' ? (
              <Caption>You can still use Mash. Friends who have your number can find you.</Caption>
            ) : null}
          </Stack>
        </ScrollView>
        <Footer>
          {stage.kind === 'declined' ? (
            <>
              <Button title="Continue" onPress={next} />
              <Button title="Try again" variant="ghost" onPress={allow} loading={asking} />
            </>
          ) : (
            <>
              <Button title="Allow contacts" onPress={allow} loading={asking} />
              <Button
                title="Skip for now"
                variant="ghost"
                onPress={() => setStage({ kind: 'declined' })}
              />
            </>
          )}
        </Footer>
      </Screen>
    );
  }

  if (stage.kind === 'phone' || stage.kind === 'error') {
    return (
      <Screen scroll={false} padded={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Stack gap={spacing.lg}>
              <Title>Find your people</Title>
              <Body color={colors.textSecondary}>
                One more thing, so your friends can find you too.
              </Body>
              <Field
                label="Your mobile"
                hint="So friends can find you. Stored only as a hash."
                placeholder={country === 'AU' ? '04xx xxx xxx' : '02x xxx xxxx'}
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  setPhoneError(null);
                }}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={phoneError}
                returnKeyType="done"
                onSubmitEditing={find}
              />
              {stage.kind === 'error' ? (
                <Caption color={colors.danger}>{stage.message}</Caption>
              ) : null}
            </Stack>
          </ScrollView>
          <Footer>
            <Button
              title={stage.kind === 'error' ? 'Try again' : 'Find my people'}
              onPress={find}
              disabled={!phone.trim()}
            />
            <Button title="Skip for now" variant="ghost" onPress={next} />
          </Footer>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (stage.kind === 'hashing' || stage.kind === 'matching') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Loading
            label={
              stage.kind === 'hashing' ? 'Hashing on your phone...' : 'Looking for your people...'
            }
          />
        </View>
      </Screen>
    );
  }

  const { matched, pendingInvites } = stage.result;
  const n = matched.length;
  return (
    <Screen scroll={false} padded={false}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Stack gap={spacing.xl}>
          <Stack gap={spacing.sm}>
            <Title>
              {n === 0
                ? 'None of your contacts are on Mash yet'
                : `${n} of your contacts ${n === 1 ? 'is' : 'are'} already on Mash`}
            </Title>
            <Body color={colors.textSecondary}>
              {n === 0
                ? `We checked ${stage.contacts} contacts. You can be the first and bring your people in.`
                : 'They are in your circle now. Nothing about your contact list was kept.'}
            </Body>
          </Stack>
          {n > 0 ? <FaceRow people={matched} size={48} max={8} /> : null}
          {pendingInvites.length > 0 ? (
            <Stack gap={spacing.lg}>
              <Heading>
                {pendingInvites.length === 1
                  ? 'Someone already invited you'
                  : 'People already invited you'}
              </Heading>
              {pendingInvites.map((inv, i) => (
                <Quote
                  key={`${inv.voucher_first_name}-${i}`}
                  text={inv.invite_message ?? 'Want in?'}
                  by={`${inv.voucher_first_name} invited you`}
                />
              ))}
            </Stack>
          ) : null}
        </Stack>
      </ScrollView>
      <Footer>
        <Button title="Continue" onPress={next} />
      </Footer>
    </Screen>
  );
}

const styles = {
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
} as const;
