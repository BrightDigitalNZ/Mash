// Invite someone not on Mash, in your own words, from your own phone. Presented as a modal.
// With ?hash=&name= the person is already chosen. Without them, pick from the phone first.
// Mash stores the hash and nothing else. Mash never contacts them.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import ContactPicker from '@/components/ContactPicker';
import {
  Body,
  Button,
  Caption,
  Field,
  Footer,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { inviteByHash } from '@/lib/api';
import { ensureContactsPermission, readHashedContacts, type LocalContact } from '@/lib/contacts';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const LEAD = 'I’m on Mash, a dating app where friends do the matching.';
const AS_MASHMAKER = `${LEAD} I’d like to be your Mashmaker.`;
const AS_CATCH = `${LEAD} I’d like you to be my Mashmaker.`;
const COPIED = 'Copied the invite. Send it from your phone.';
const MAX = 300;

type Target = { hash: string; name: string };
type Pick =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'denied' }
  | { kind: 'error' }
  | { kind: 'ready'; contacts: LocalContact[] };

function copyToClipboard(text: string) {
  try {
    const nav = (
      globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }
    ).navigator;
    nav?.clipboard?.writeText?.(text).catch(() => {});
  } catch {
    // Not available here. The message on screen says what to do.
  }
}

export default function Invite() {
  const params = useLocalSearchParams<{ hash?: string; name?: string }>();
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.session?.user.id);
  const country = profile?.country ?? 'NZ';

  const [target, setTarget] = useState<Target | null>(
    params.hash ? { hash: params.hash, name: params.name ?? 'your friend' } : null,
  );
  const [pick, setPick] = useState<Pick>({ kind: 'idle' });
  const [message, setMessage] = useState(profile?.role === 'mashmaker' ? AS_MASHMAKER : AS_CATCH);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function readContacts() {
    setPick({ kind: 'reading' });
    try {
      const granted = await ensureContactsPermission();
      if (!granted) {
        track(Events.contactsDeclined);
        setPick({ kind: 'denied' });
        return;
      }
      track(Events.contactsGranted);
      const contacts = await readHashedContacts(country);
      setPick({ kind: 'ready', contacts });
    } catch {
      setPick({ kind: 'error' });
    }
  }

  async function send() {
    if (!userId || !profile || !target || sending) return;
    const text = message.trim();
    if (!text) {
      setError('Write a line first. It goes out under your name.');
      return;
    }
    setSending(true);
    setError(null);
    const noShareSheet = DEMO || Platform.OS === 'web';
    try {
      await inviteByHash({
        inviterId: userId,
        inviterFirstName: profile.first_name,
        inviteeHash: target.hash,
        inviteeName: target.name,
        message: text,
      });
      if (noShareSheet) {
        copyToClipboard(text);
        setDone(COPIED);
      } else {
        setDone(`Sent to ${target.name} from your phone.`);
      }
    } catch {
      if (noShareSheet) {
        copyToClipboard(text);
        setDone(COPIED);
      } else {
        setError(copy.errors.didNotSend);
      }
    } finally {
      setSending(false);
    }
  }

  const header = (
    <Stack gap={spacing.sm}>
      <Title>Invite a friend</Title>
      <Body color={colors.textSecondary}>
        {target
          ? `${target.name} isn’t on Mash yet. The invite comes from you, in your words.`
          : 'Pick someone from your phone. The invite comes from you, in your words.'}
      </Body>
    </Stack>
  );

  if (!userId || !profile) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen scroll={false} padded={false}>
        <Stack gap={spacing.sm} style={{ flex: 1, padding: spacing.xl }}>
          <Title>Invite ready</Title>
          <Body color={colors.textSecondary}>{done}</Body>
          <Caption>
            When they join, they land in your people and you can take it from there.
          </Caption>
        </Stack>
        <Footer>
          <Button title="Done" onPress={close} />
        </Footer>
      </Screen>
    );
  }

  if (!target) {
    return (
      <Screen scroll={false} padded={false}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            {header}
            {pick.kind === 'idle' ? (
              <Caption>{copy.onboarding.contacts}</Caption>
            ) : pick.kind === 'reading' ? (
              <Loading label="Hashing on your phone." />
            ) : pick.kind === 'denied' ? (
              <Caption>
                Mash needs your contacts to send an invite from your phone. You can allow it in your
                phone’s Settings.
              </Caption>
            ) : pick.kind === 'error' ? (
              <Caption color={colors.danger}>{copy.errors.didNotLoad}</Caption>
            ) : (
              <ContactPicker
                matched={[]}
                showMatched={false}
                contacts={pick.contacts}
                excludeHashes={profile.phone_hash ? [profile.phone_hash] : []}
                onInvite={(c) => {
                  const hash = c.hashes[0];
                  if (hash) setTarget({ hash, name: c.name });
                }}
              />
            )}
          </Stack>
        </ScrollView>
        <Footer>
          {pick.kind === 'idle' || pick.kind === 'error' ? (
            <Button
              title={pick.kind === 'idle' ? 'Read my contacts' : 'Try again'}
              onPress={readContacts}
            />
          ) : null}
          <Button title="Cancel" variant="ghost" onPress={close} />
        </Footer>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            {header}
            <Field
              label="Your invite"
              multiline
              value={message}
              onChangeText={(t) => setMessage(t.slice(0, MAX))}
              maxLength={MAX}
              editable={!sending}
              hint={`${message.length}/${MAX}`}
              accessibilityLabel="Your invite message"
            />
            <Caption>
              Mash never contacts them. The invite comes from you and says who you are. Ignoring it
              does nothing.
            </Caption>
          </Stack>
        </ScrollView>
        <Footer>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button title="Send from my phone" onPress={send} loading={sending} />
          <Button title="Cancel" variant="ghost" onPress={close} disabled={sending} />
        </Footer>
      </KeyboardAvoidingView>
    </Screen>
  );
}
