// The Machine's checks: what due diligence is, the consent to be checked, and the public pages
// the Machine may read. A brief is only ever shown to the Catch who asked for it.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Divider,
  ErrorView,
  Field,
  Heading,
  Label,
  ListRow,
  Loading,
  Screen,
  Stack,
} from '@/components/ui';
import { keys, useLinkedProfiles } from '@/hooks/useData';
import { addLinkedProfile, removeLinkedProfile } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { LinkedKind } from '@/types/database';

const KINDS: { kind: LinkedKind; label: string }[] = [
  { kind: 'instagram', label: 'Instagram' },
  { kind: 'linkedin', label: 'LinkedIn' },
  { kind: 'website', label: 'Website' },
  { kind: 'other', label: 'Other' },
];

const CONSENT_CAPTION =
  'Specific to this. Only shown to the Catch who asked. Never to your Mashmaker, never to you. Deleted when the mash closes.';

const kindLabel = (k: LinkedKind) => KINDS.find((x) => x.kind === k)?.label ?? 'Link';

function isValidUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith('https://')) return false;
  try {
    return new URL(u).hostname.includes('.');
  } catch {
    return false;
  }
}

export default function ChecksScreen() {
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const qc = useQueryClient();
  const linked = useLinkedProfiles(me);

  const [consenting, setConsenting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [kind, setKind] = useState<LinkedKind>('instagram');
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const consent = !!profile?.dd_consent;
  const refresh = () => qc.invalidateQueries({ queryKey: keys.linked(me ?? '') });

  const setConsent = async (value: boolean) => {
    if (consenting || value === consent) return;
    setConsenting(true);
    setConsentError(null);
    try {
      await updateProfile({ dd_consent: value });
    } catch {
      setConsentError(copy.errors.didNotSave);
    } finally {
      setConsenting(false);
    }
  };

  const add = async () => {
    if (!me) return;
    if (!isValidUrl(url)) {
      setUrlError('Needs to be a full link starting with https://');
      return;
    }
    setUrlError(null);
    setAdding(true);
    setLinkError(null);
    try {
      await addLinkedProfile(me, kind, url.trim());
      setUrl('');
      refresh();
    } catch {
      setLinkError(copy.errors.didNotSave);
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    setLinkError(null);
    try {
      await removeLinkedProfile(id);
      refresh();
    } catch {
      setLinkError(copy.errors.didNotSave);
    } finally {
      setRemovingId(null);
    }
  };

  const links = linked.data ?? [];

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Body color={colors.textSecondary}>
          {copy.plus.what} {copy.plus.limitation}
        </Body>

        <Card tone="alt">
          <Heading>Let the Machine run checks on me</Heading>
          <Caption>{consent ? 'You’ve said yes.' : 'You haven’t said yes.'}</Caption>
          <Stack row gap={spacing.sm}>
            <Button
              title="Yes"
              variant={consent ? 'primary' : 'secondary'}
              full={false}
              small
              onPress={() => setConsent(true)}
              disabled={consenting}
              accessibilityLabel="Yes, the Machine may run checks on me"
            />
            <Button
              title="No"
              variant={consent ? 'secondary' : 'primary'}
              full={false}
              small
              onPress={() => setConsent(false)}
              disabled={consenting}
              accessibilityLabel="No, the Machine may not run checks on me"
            />
          </Stack>
          <Caption>{CONSENT_CAPTION}</Caption>
          {consentError ? <Caption color={colors.danger}>{consentError}</Caption> : null}
        </Card>

        <Divider />

        <Stack gap={spacing.sm}>
          <Label>Pages the Machine may read</Label>
          <Caption>Public pages only. Nothing behind a login.</Caption>
          {linked.isLoading ? (
            <Loading />
          ) : linked.error ? (
            <ErrorView message={copy.errors.didNotLoad} onRetry={() => linked.refetch()} />
          ) : links.length === 0 ? (
            <Caption>Nothing yet. Only what you add here is ever read.</Caption>
          ) : (
            links.map((l) => (
              <ListRow
                key={l.id}
                title={kindLabel(l.kind)}
                subtitle={l.url}
                right={
                  <Pressable
                    onPress={() => remove(l.id)}
                    disabled={removingId === l.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${kindLabel(l.kind)} link`}
                    hitSlop={12}
                  >
                    <Ionicons name="close-circle-outline" size={24} color={colors.textMuted} />
                  </Pressable>
                }
              />
            ))
          )}
        </Stack>

        <Stack gap={spacing.sm}>
          <Label>Add a page</Label>
          <Stack row wrap gap={spacing.sm}>
            {KINDS.map((k) => (
              <Chip
                key={k.kind}
                label={k.label}
                selected={kind === k.kind}
                onPress={() => setKind(k.kind)}
              />
            ))}
          </Stack>
          <Field
            value={url}
            onChangeText={(t) => {
              setUrl(t);
              if (urlError) setUrlError(null);
            }}
            placeholder="https://"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            error={urlError}
            accessibilityLabel="Page address"
          />
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              title="Add"
              variant="secondary"
              full={false}
              small
              onPress={add}
              loading={adding}
              disabled={!url.trim()}
            />
          </View>
          {linkError ? <Caption color={colors.danger}>{linkError}</Caption> : null}
        </Stack>
      </Stack>
    </Screen>
  );
}
