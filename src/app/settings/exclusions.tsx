// People never to show me. Stored as hashes only. Silent and permanent: nobody is told,
// not the person, not a Mashmaker.

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Body,
  Button,
  Caption,
  Divider,
  ErrorView,
  Field,
  Label,
  ListRow,
  Loading,
  Screen,
  Stack,
} from '@/components/ui';
import { keys, useExclusions } from '@/hooks/useData';
import { addExclusion, removeExclusion } from '@/lib/api';
import {
  ensureContactsPermission,
  hashPhone,
  normalisePhone,
  readHashedContacts,
  type LocalContact,
} from '@/lib/contacts';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const shortHash = (hash: string) => `${hash.slice(0, 8)}…`;

export default function ExclusionsScreen() {
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const qc = useQueryClient();
  const exclusions = useExclusions();

  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [busyHash, setBusyHash] = useState<string | null>(null);
  const [contacts, setContacts] = useState<LocalContact[] | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [contactsMessage, setContactsMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = exclusions.data ?? [];
  const excludedHashes = new Set(rows.map((r) => r.hash));
  const refresh = () => qc.invalidateQueries({ queryKey: keys.exclusions });

  const exclude = async (hash: string) => {
    if (!me || busyHash) return;
    setBusyHash(hash);
    setError(null);
    try {
      await addExclusion(me, hash);
      refresh();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setBusyHash(null);
    }
  };

  const remove = async (hash: string) => {
    if (!me || busyHash) return;
    setBusyHash(hash);
    setError(null);
    try {
      await removeExclusion(me, hash);
      refresh();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setBusyHash(null);
    }
  };

  const addNumber = async () => {
    if (!me) return;
    const digits = normalisePhone(phone, profile?.country ?? 'NZ');
    if (!digits) {
      setPhoneError('That isn’t a phone number we can use.');
      return;
    }
    setPhoneError(null);
    setAdding(true);
    setError(null);
    try {
      const hash = DEMO ? `hash-${digits}` : await hashPhone(digits);
      await addExclusion(me, hash);
      setPhone('');
      refresh();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setAdding(false);
    }
  };

  const pickFromContacts = async () => {
    setLoadingContacts(true);
    setContactsMessage(null);
    try {
      const allowed = await ensureContactsPermission();
      if (!allowed) {
        setContactsMessage(
          'Mash can’t read your contacts. Allow it in your phone’s settings first.',
        );
        return;
      }
      const list = await readHashedContacts(profile?.country ?? 'NZ');
      setContacts(list);
      if (list.length === 0) setContactsMessage('No contacts with a phone number.');
    } catch {
      setContactsMessage(copy.errors.didNotLoad);
    } finally {
      setLoadingContacts(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Body color={colors.textSecondary}>
          Silent and permanent. Nobody is told, not even your Mashmaker.
        </Body>

        <Stack gap={spacing.sm}>
          <Label>Never shown to me</Label>
          {exclusions.isLoading ? (
            <Loading />
          ) : exclusions.error ? (
            <ErrorView message={copy.errors.didNotLoad} onRetry={() => exclusions.refetch()} />
          ) : rows.length === 0 ? (
            <Caption>Nobody yet. We only ever keep a hash, never a name or a number.</Caption>
          ) : (
            rows.map((r) => (
              <ListRow
                key={r.hash}
                title={shortHash(r.hash)}
                subtitle="A hashed number. We never see who it is."
                right={
                  <Button
                    title="Remove"
                    variant="ghost"
                    full={false}
                    small
                    onPress={() => remove(r.hash)}
                    loading={busyHash === r.hash}
                    disabled={!!busyHash && busyHash !== r.hash}
                    accessibilityLabel={`Remove ${shortHash(r.hash)}`}
                  />
                }
              />
            ))
          )}
        </Stack>

        <Divider />

        <Stack gap={spacing.sm}>
          <Label>Add a number</Label>
          <Field
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (phoneError) setPhoneError(null);
            }}
            placeholder="021 123 4567"
            keyboardType="phone-pad"
            autoCorrect={false}
            error={phoneError}
            hint="Hashed on your phone before it leaves. We never see the number."
            accessibilityLabel="Phone number to exclude"
          />
          <Button
            title="Exclude this number"
            variant="secondary"
            full={false}
            small
            onPress={addNumber}
            loading={adding}
            disabled={!phone.trim()}
          />
        </Stack>

        <Stack gap={spacing.sm}>
          <Label>Or pick from contacts</Label>
          <Button
            title="Pick from contacts"
            variant="secondary"
            full={false}
            small
            onPress={pickFromContacts}
            loading={loadingContacts}
          />
          {contactsMessage ? <Caption>{contactsMessage}</Caption> : null}
          {contacts
            ? contacts.map((c) => {
                const hash = c.hashes[0];
                if (!hash) return null;
                const done = c.hashes.some((h) => excludedHashes.has(h));
                return (
                  <ListRow
                    key={c.id}
                    title={c.name}
                    right={
                      done ? (
                        <Caption>Excluded</Caption>
                      ) : (
                        <Button
                          title="Exclude"
                          variant="ghost"
                          full={false}
                          small
                          onPress={() => exclude(hash)}
                          loading={busyHash === hash}
                          disabled={!!busyHash && busyHash !== hash}
                          accessibilityLabel={`Exclude ${c.name}`}
                        />
                      )
                    }
                  />
                );
              })
            : null}
        </Stack>

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
      </Stack>
    </Screen>
  );
}
