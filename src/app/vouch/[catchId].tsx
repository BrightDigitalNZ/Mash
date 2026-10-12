// Write or edit the Mashmaker's note about a Catch. Their words, untouched. Mash never edits a note.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Button, Caption, ErrorView, Field, Heading, Loading, Screen, Stack, Title } from '@/components/ui';
import { keys, useAppSettings, useProfile, useVouchPrompt, useVouchesFor } from '@/hooks/useData';
import { checkNote, removeVouch, writeVouch } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { PublicProfile, VouchPrompt } from '@/types/database';

const MAX = 400;
const HINT = 'Say why. Make it about the two people, not about you.';

type Existing = { prompt_id?: number | null; prompt: string; text: string; how_known: string | null };

export default function VouchScreen() {
  const { catchId } = useLocalSearchParams<{ catchId: string }>();
  const me = useSession((s) => s.session?.user.id);
  const person = useProfile(catchId);
  const prompt = useVouchPrompt();
  const vouches = useVouchesFor(catchId);
  const settings = useAppSettings();

  const loading = person.isLoading || prompt.isLoading || vouches.isLoading || settings.isLoading;
  const mine = (vouches.data ?? []).find((v) => v.mashmaker_id === me) ?? null;
  const minLength = Number(settings.data?.vouch_min_length ?? '20') || 20;

  return (
    <Screen>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={12}
        style={{ alignSelf: 'flex-start', marginBottom: spacing.md }}
      >
        <Ionicons name="close" size={28} color={colors.primary} />
      </Pressable>

      {loading || !me || !catchId ? (
        <Loading />
      ) : prompt.error || !prompt.data ? (
        <ErrorView message={copy.errors.didNotLoad} onRetry={() => prompt.refetch()} />
      ) : (
        <VouchForm me={me} catchId={catchId} person={person.data ?? null} prompt={prompt.data} existing={mine} minLength={minLength} />
      )}
    </Screen>
  );
}

/** Mounted once everything is loaded, so an existing note can seed state directly. */
function VouchForm({
  me,
  catchId,
  person,
  prompt,
  existing,
  minLength,
}: {
  me: string;
  catchId: string;
  person: PublicProfile | null;
  prompt: VouchPrompt;
  existing: Existing | null;
  minLength: number;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(existing?.text ?? '');
  const [howKnown, setHowKnown] = useState(existing?.how_known ?? '');
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = person?.first_name ?? 'them';
  // An existing note answers the prompt it was written to. Editing keeps that prompt.
  const promptId = existing ? (existing.prompt_id ?? null) : prompt.id;
  const promptText = existing ? existing.prompt : prompt.text;
  const trimmed = text.trim();

  // Screen the note as they type, a beat behind the keyboard.
  useEffect(() => {
    const t = setTimeout(() => setProblems(trimmed ? checkNote(trimmed, minLength) : []), 300);
    return () => clearTimeout(t);
  }, [trimmed, minLength]);

  const canSave = trimmed.length >= minLength && trimmed.length <= MAX && problems.length === 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.catches });
    qc.invalidateQueries({ queryKey: keys.vouchesFor(catchId) });
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await writeVouch({ mashmakerId: me, catchId, promptId, prompt: promptText, text: trimmed, howKnown: howKnown.trim() || null, minLength });
      invalidate();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.errors.didNotSave);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setRemoving(true);
    setError(null);
    try {
      await removeVouch(me, catchId);
      invalidate();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : copy.errors.didNotSave);
      setRemoving(false);
    }
  };

  const counter = `${trimmed.length} of ${MAX}`;
  const problemText = problems.length ? problems.join(' ') : null;

  return (
    <Stack gap={spacing.xl}>
      <Stack row align="center" gap={spacing.md}>
        <Avatar uri={person?.photo_url} name={person?.first_name} size={56} />
        <View style={{ flex: 1 }}>
          <Title>{existing ? `Your note about ${name}` : `A line about ${name}`}</Title>
        </View>
      </Stack>

      <Stack gap={spacing.xs}>
        <Heading>{promptText}</Heading>
        <Caption>{existing ? 'The prompt you answered.' : 'This week’s prompt.'}</Caption>
      </Stack>

      <Field
        multiline
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX))}
        maxLength={MAX}
        placeholder="“You both hate small talk and both ran the half this year.”"
        hint={`${HINT} ${counter}.`}
        error={problemText}
        accessibilityLabel={`Your note about ${name}`}
      />

      <Field
        label="How you know them"
        value={howKnown}
        onChangeText={setHowKnown}
        maxLength={120}
        placeholder="Flatmates in 2012, work, my sister’s friend"
        accessibilityLabel="How you know them"
      />

      <Caption>Your words, untouched. Mash never edits a note.</Caption>

      {error ? <Caption color={colors.danger}>{error}</Caption> : null}

      <Stack gap={spacing.sm}>
        <View testID="save-note">
          <Button title={existing ? 'Save your note' : 'Add your note'} onPress={save} loading={saving} disabled={!canSave || removing} />
        </View>
        {existing && !confirmRemove ? (
          <Button title="Remove your note" variant="ghost" onPress={() => setConfirmRemove(true)} disabled={saving} />
        ) : null}
        {existing && confirmRemove ? (
          <Stack gap={spacing.sm}>
            <Caption>Remove your note about {name}? You can write another later.</Caption>
            <Stack row gap={spacing.sm}>
              <View style={{ flex: 1 }}>
                <Button title="Keep it" variant="secondary" onPress={() => setConfirmRemove(false)} disabled={removing} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Remove" variant="danger" onPress={remove} loading={removing} disabled={saving} />
              </View>
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );
}
