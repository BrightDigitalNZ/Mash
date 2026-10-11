import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import {
  Body,
  Button,
  Caption,
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
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { LinkedKind } from '@/types/database';

const KINDS: { kind: LinkedKind; label: string }[] = [
  { kind: 'instagram', label: 'Instagram' },
  { kind: 'linkedin', label: 'LinkedIn' },
  { kind: 'website', label: 'Website' },
  { kind: 'other', label: 'Other' },
];

const kindLabel = (k: LinkedKind) => KINDS.find((x) => x.kind === k)?.label ?? 'Link';

function isValidUrl(url: string): boolean {
  const u = url.trim();
  if (!u.startsWith('https://')) return false;
  try {
    const parsed = new URL(u);
    return parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

export default function LinkedSettings() {
  const me = useSession((s) => s.session?.user.id);
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const qc = useQueryClient();
  const linked = useLinkedProfiles(me);

  const [kind, setKind] = useState<LinkedKind>('instagram');
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: keys.linked(me ?? '') });

  const setConsent = async (patch: {
    brief_consent?: boolean;
    reverse_image_consent?: boolean;
  }) => {
    setSwitching(true);
    setError(null);
    try {
      await updateProfile(patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update that.');
    } finally {
      setSwitching(false);
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
    setError(null);
    try {
      await addLinkedProfile(me, kind, url.trim());
      setUrl('');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that link.');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setRemovingId(id);
    setError(null);
    try {
      await removeLinkedProfile(id);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove that link.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.sm}>
          <Heading>Your brief</Heading>
          <Body color={colors.textSecondary}>
            When you&apos;re introduced, the matchmaker writes a one-page brief about you from the
            links below and your friends&apos; vouches. Nothing is searched for. You see it before
            anyone else does.
          </Body>
        </Stack>

        <ListRow
          title="Share a brief about me"
          right={
            <Switch
              value={!!profile?.brief_consent}
              onValueChange={(v) => setConsent({ brief_consent: v })}
              disabled={switching || !profile}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Share a brief about me"
            />
          }
        />

        <Divider />

        <Stack gap={spacing.sm}>
          <Label>Linked profiles</Label>
          {linked.isLoading ? (
            <Loading />
          ) : linked.error ? (
            <ErrorView message="Could not load your links." onRetry={() => linked.refetch()} />
          ) : (linked.data ?? []).length === 0 ? (
            <Caption>No links yet. Only what you add here is ever read.</Caption>
          ) : (
            (linked.data ?? []).map((l) => (
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
          <Label>Add a link</Label>
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
        </Stack>

        <Divider />

        <Stack gap={spacing.xs}>
          <ListRow
            title="Let the matchmaker check my photos aren't stolen"
            right={
              <Switch
                value={!!profile?.reverse_image_consent}
                onValueChange={(v) => setConsent({ reverse_image_consent: v })}
                disabled={switching || !profile}
                trackColor={{ true: colors.primary, false: colors.border }}
                accessibilityLabel="Let the matchmaker check my photos aren't stolen"
              />
            }
          />
          <Caption>
            Runs a reverse image search on your own photos only, with your permission.
          </Caption>
        </Stack>

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
      </Stack>
    </Screen>
  );
}
