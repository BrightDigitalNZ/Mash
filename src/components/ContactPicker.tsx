// Contacts live here, in memory, for the life of the app session. Never persisted, never sent.
// The picker shows names and faces from the phone; only hashes ever go to the server.

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Chip,
  Empty,
  Field,
  Footer,
  Stack,
  Title,
} from '@/components/ui';
import { inviteByHash } from '@/lib/api';
import type { LocalContact } from '@/lib/contacts';
import { colors, radius, spacing } from '@/theme';

// --- module-level cache -----------------------------------------------------

let cached: LocalContact[] = [];

export function setCachedContacts(contacts: LocalContact[]) {
  cached = contacts;
}

export function getCachedContacts(): LocalContact[] {
  return cached;
}

// Hashes of contacts who are already on Mash. Hidden from the invite picker.
let cachedOnMash: string[] = [];

export function setCachedOnMashHashes(hashes: string[]) {
  cachedOnMash = hashes;
}

export function getCachedOnMashHashes(): string[] {
  return cachedOnMash;
}

// --- picker -----------------------------------------------------------------

export default function ContactPicker({
  contacts,
  excludeHashes,
  selected,
  onToggle,
  maxSelected,
}: {
  contacts: LocalContact[];
  /** hashes of people already on Mash: they do not need an invite */
  excludeHashes: string[];
  selected: string[];
  onToggle: (contact: LocalContact) => void;
  maxSelected?: number;
}) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const exclude = new Set(excludeHashes);
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (c.hashes.some((h) => exclude.has(h))) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q);
    });
  }, [contacts, excludeHashes, query]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const full = maxSelected !== undefined && selected.length >= maxSelected;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
        <Field
          placeholder="Search your contacts"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          accessibilityLabel="Search your contacts"
        />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
        initialNumToRender={20}
        ListEmptyComponent={
          <Empty
            title={query ? 'No one by that name' : 'No contacts to show'}
            body={query ? 'Try a shorter search.' : 'Contacts with a phone number show up here.'}
          />
        }
        renderItem={({ item }) => {
          const isSelected = selectedSet.has(item.id);
          const disabled = !isSelected && full;
          return (
            <Pressable
              onPress={() => onToggle(item)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityLabel={item.name}
              accessibilityState={{ checked: isSelected, disabled }}
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.8 },
                disabled && { opacity: 0.4 },
              ]}
            >
              <Avatar uri={item.image} name={item.name} size={44} />
              <Body style={{ flex: 1 }} numberOfLines={1}>
                {item.name}
              </Body>
              <View style={[styles.check, isSelected && styles.checkOn]}>
                {isSelected ? (
                  <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

// --- the invite flow, shared by onboarding and the modal ---------------------

export const DEFAULT_INVITE =
  "I'm on Mash, a dating app where friends vouch for each other. I'd vouch for you. Want in?";

export const MAX_INVITES = 10;

/**
 * Pick up to ten people, write the invite in your own words, send one at a time.
 * Each send opens the system share sheet; the server only ever stores the hash.
 */
export function InviteFlow({
  contacts,
  excludeHashes,
  voucherId,
  voucherFirstName,
  onDone,
  onSkip,
  skipLabel = 'Not now',
}: {
  contacts: LocalContact[];
  excludeHashes: string[];
  voucherId: string;
  voucherFirstName: string;
  /** called after the last invite is sent (or none were) */
  onDone: (sent: number) => void;
  onSkip: () => void;
  skipLabel?: string;
}) {
  const [step, setStep] = useState<'pick' | 'write'>('pick');
  const [selected, setSelected] = useState<LocalContact[]>([]);
  const [message, setMessage] = useState(DEFAULT_INVITE);
  const [sending, setSending] = useState<{ index: number; total: number } | null>(null);
  const [sent, setSent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => selected.map((c) => c.id), [selected]);

  function toggle(contact: LocalContact) {
    setSelected((list) => {
      if (list.some((c) => c.id === contact.id)) return list.filter((c) => c.id !== contact.id);
      if (list.length >= MAX_INVITES) return list;
      return [...list, contact];
    });
  }

  async function send() {
    const text = message.trim();
    if (!text) {
      setError('Write a line first. It goes out under your name.');
      return;
    }
    setError(null);
    let count = sent;
    const queue = selected.slice(sent);
    for (let i = 0; i < queue.length; i++) {
      const contact = queue[i];
      const hash = contact?.hashes[0];
      if (!contact || !hash) continue;
      setSending({ index: count + 1, total: selected.length });
      try {
        await inviteByHash({
          voucherId,
          voucherFirstName,
          nomineeHash: hash,
          nomineeName: contact.name,
          message: text,
        });
        count += 1;
        setSent(count);
      } catch {
        setSending(null);
        setError(`The invite to ${contact.name} did not go out. You can try the rest again.`);
        return;
      }
    }
    setSending(null);
    onDone(count);
  }

  if (step === 'pick') {
    return (
      <View style={{ flex: 1 }}>
        <ContactPicker
          contacts={contacts}
          excludeHashes={excludeHashes}
          selected={selectedIds}
          onToggle={toggle}
          maxSelected={MAX_INVITES}
        />
        <Footer>
          <Caption>
            {selected.length === 0
              ? `Pick up to ${MAX_INVITES} people.`
              : `${selected.length} of ${MAX_INVITES} picked.`}
          </Caption>
          <Button
            title={selected.length === 0 ? 'Next' : `Next with ${selected.length}`}
            disabled={selected.length === 0}
            onPress={() => setStep('write')}
          />
          <Button title={skipLabel} variant="ghost" onPress={onSkip} />
        </Footer>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={spacing.lg}>
          <Title>Your invite</Title>
          <Stack row wrap gap={spacing.sm}>
            {selected.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected
                onPress={sending || sent > 0 ? undefined : () => toggle(c)}
              />
            ))}
          </Stack>
          <Caption>
            {sent > 0 ? 'Sent so far: ' + sent + '. ' : 'Tap a name to drop them. '}The message goes
            out to each person, from you, with a link.
          </Caption>
          <Field
            label="Your invite"
            multiline
            value={message}
            onChangeText={(t) => setMessage(t.slice(0, 300))}
            maxLength={300}
            editable={!sending}
            accessibilityLabel="Your invite message"
          />
        </Stack>
      </ScrollView>
      <Footer>
        {sending ? (
          <Caption>
            Sending {sending.index} of {sending.total}. The share sheet opens for each one.
          </Caption>
        ) : null}
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        <Button
          title={
            sent > 0 && sent < selected.length
              ? 'Send the rest'
              : selected.length === 1
                ? 'Send invite'
                : 'Send invites'
          }
          onPress={send}
          loading={!!sending}
          disabled={selected.length === 0}
        />
        <Button
          title="Back to the list"
          variant="ghost"
          onPress={() => setStep('pick')}
          disabled={!!sending || sent > 0}
        />
      </Footer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
