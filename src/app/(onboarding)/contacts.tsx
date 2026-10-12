// The privacy-critical step. Contacts are read on the phone, hashed on the phone, and only the
// hashes go up, and only when the button is pressed. Nothing is synced silently.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import ContactPicker from '@/components/ContactPicker';
import {
  Body,
  Button,
  Caption,
  Card,
  Field,
  Footer,
  Heading,
  Loading,
  Quote,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { matchContacts, type MatchContactsResult } from '@/lib/api';
import {
  allHashes,
  ensureContactsPermission,
  hashPhone,
  normalisePhone,
  readHashedContacts,
  type LocalContact,
} from '@/lib/contacts';
import { copy } from '@/lib/copy';
import { homeFor, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type Stage =
  | { kind: 'ask' }
  | { kind: 'declined' }
  | { kind: 'reading' }
  | { kind: 'matching' }
  | { kind: 'result'; result: MatchContactsResult; contacts: LocalContact[]; myHash: string | null }
  | { kind: 'error' };

export default function Contacts() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const qc = useQueryClient();
  const country = profile?.country ?? 'NZ';
  const isCatch = profile?.role === 'catch';

  const [stage, setStage] = useState<Stage>({ kind: 'ask' });
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function read() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const granted = await ensureContactsPermission();
      if (!granted) {
        track(Events.contactsDeclined);
        setStage({ kind: 'declined' });
        return;
      }
      track(Events.contactsGranted);
      setStage({ kind: 'reading' });
      const normalised = phone.trim() ? normalisePhone(phone, country) : null;
      const myHash = normalised ? await hashPhone(normalised) : null;
      const contacts = await readHashedContacts(country);
      setStage({ kind: 'matching' });
      const result = await matchContacts(allHashes(contacts), myHash ?? undefined);
      qc.invalidateQueries({ queryKey: keys.connections });
      refreshProfile().catch(() => {});
      setStage({ kind: 'result', result, contacts, myHash });
    } catch {
      setStage({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (busy) return;
    if (isCatch) {
      router.replace('/(onboarding)/ask');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateProfile({ onboarding_complete: true });
      router.replace(homeFor(updated) as never);
    } catch {
      setError(copy.errors.didNotSave);
      setBusy(false);
    }
  }

  function invite(c: LocalContact) {
    const hash = c.hashes[0];
    if (!hash) return;
    router.push(
      `/invite?hash=${encodeURIComponent(hash)}&name=${encodeURIComponent(c.name)}` as never,
    );
  }

  const content = {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  } as const;

  if (stage.kind === 'ask' || stage.kind === 'declined' || stage.kind === 'error') {
    return (
      <Screen scroll={false} padded={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Stack gap={spacing.lg}>
              <Title>Find your people</Title>
              <Body color={colors.textSecondary}>{copy.onboarding.contacts}</Body>
              <Card tone="alt">
                <Caption>What a hash is</Caption>
                <Body>
                  A one-way scramble of a number. We can tell two people have the same number
                  without ever knowing what it is. Names and photos never leave your phone.
                </Body>
              </Card>
              <Field
                label="Your mobile (optional)"
                hint="So friends can find you. Stored only as a hash."
                placeholder={country === 'AU' ? '04xx xxx xxx' : '02x xxx xxxx'}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                returnKeyType="done"
              />
              {stage.kind === 'declined' ? (
                <Caption>
                  No contacts read. You can still use Mash. Friends who have your number can find
                  you, and you can read your contacts later from Settings.
                </Caption>
              ) : null}
              {stage.kind === 'error' ? (
                <Caption color={colors.danger}>{copy.errors.didNotLoad}</Caption>
              ) : null}
            </Stack>
          </ScrollView>
          <Footer>
            {error ? <Caption color={colors.danger}>{error}</Caption> : null}
            <Button
              title={stage.kind === 'ask' ? 'Read my contacts' : 'Try again'}
              onPress={read}
              loading={busy && stage.kind !== 'declined'}
            />
            <Button title="Skip for now" variant="ghost" onPress={next} disabled={busy} />
          </Footer>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  if (stage.kind === 'reading' || stage.kind === 'matching') {
    return (
      <Screen scroll={false}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Loading
            label={stage.kind === 'reading' ? 'Hashing on your phone.' : 'Looking for your people.'}
          />
        </View>
      </Screen>
    );
  }

  const { matched, pendingInvites } = stage.result;
  const n = matched.length;
  return (
    <Screen scroll={false} padded={false}>
      <ScrollView contentContainerStyle={content} showsVerticalScrollIndicator={false}>
        <Stack gap={spacing.xl}>
          <Stack gap={spacing.sm}>
            <Title>
              {n === 0
                ? 'None of your contacts are on Mash yet'
                : `${n} of your contacts ${n === 1 ? 'is' : 'are'} on Mash`}
            </Title>
            <Body color={colors.textSecondary}>
              {n === 0
                ? `We checked ${stage.contacts.length} contacts. Nothing about your contact list was kept.`
                : 'Nothing about your contact list was kept.'}
            </Body>
          </Stack>
          {pendingInvites.length > 0 ? (
            <Stack gap={spacing.md}>
              <Heading>
                {pendingInvites.length === 1 ? 'Someone invited you' : 'People invited you'}
              </Heading>
              {pendingInvites.map((inv, i) => (
                <Quote
                  key={`${inv.inviter_first_name}-${i}`}
                  text={inv.message ?? 'Come and join me on Mash.'}
                  by={`${inv.inviter_first_name} invited you`}
                />
              ))}
            </Stack>
          ) : null}
          <ContactPicker
            matched={matched}
            contacts={stage.contacts}
            excludeHashes={stage.myHash ? [stage.myHash] : []}
            onInvite={invite}
          />
        </Stack>
      </ScrollView>
      <Footer>
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        <Button title="Continue" onPress={next} loading={busy} />
      </Footer>
    </Screen>
  );
}
