import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import {
  Avatar,
  Button,
  Caption,
  ErrorView,
  Field,
  Heading,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useProfile, useVouchPrompt } from '@/hooks/useData';
import { removeVouch, writeVouch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { PublicProfile, Vouch, VouchPrompt } from '@/types/database';

const MIN = 10;
const MAX = 400;

const myVouchKey = (me: string, singleId: string) => ['myVouch', me, singleId] as const;

export default function VouchScreen() {
  const { singleId } = useLocalSearchParams<{ singleId: string }>();
  const me = useSession((s) => s.session?.user.id);
  const single = useProfile(singleId);
  const prompt = useVouchPrompt();

  const existing = useQuery({
    queryKey: myVouchKey(me ?? '', singleId ?? ''),
    enabled: !!me && !!singleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vouches')
        .select('*')
        .eq('voucher_id', me!)
        .eq('single_id', singleId!)
        .maybeSingle();
      if (error) throw error;
      return (data as Vouch | null) ?? null;
    },
  });

  const loading = single.isLoading || prompt.isLoading || existing.isLoading;

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

      {loading || !me || !singleId ? (
        <Loading />
      ) : prompt.error || !prompt.data ? (
        <ErrorView message="Could not load this week's prompt." onRetry={() => prompt.refetch()} />
      ) : (
        <VouchForm
          me={me}
          singleId={singleId}
          single={single.data ?? null}
          prompt={prompt.data}
          existing={existing.data ?? null}
        />
      )}
    </Screen>
  );
}

/** Mounted only once everything is loaded, so the existing vouch can seed state directly. */
function VouchForm({
  me,
  singleId,
  single,
  prompt,
  existing,
}: {
  me: string;
  singleId: string;
  single: PublicProfile | null;
  prompt: VouchPrompt;
  existing: Vouch | null;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState(existing?.text ?? '');
  const [howKnown, setHowKnown] = useState(existing?.how_known ?? '');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = text.trim();
  const canSave = trimmed.length >= MIN && trimmed.length <= MAX;
  const firstName = single?.first_name ?? 'your friend';
  // An existing vouch answers the prompt it was written to. Editing keeps that prompt rather than
  // silently re-filing the old sentence under this week's question.
  const promptId = existing ? existing.prompt_id : prompt.id;
  const promptText = existing ? existing.prompt : prompt.text;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.mySingles });
    qc.invalidateQueries({ queryKey: keys.vouchesFor(singleId) });
    qc.invalidateQueries({ queryKey: myVouchKey(me, singleId) });
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await writeVouch({
        voucherId: me,
        singleId,
        promptId,
        prompt: promptText,
        text: trimmed,
        howKnown: howKnown.trim() || null,
      });
      invalidate();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your vouch.');
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    Alert.alert('Remove your vouch?', `${firstName} will no longer have you in their circle.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemoving(true);
          try {
            await removeVouch(me, singleId);
            invalidate();
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not remove your vouch.');
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  const counter =
    trimmed.length > 0 && trimmed.length < MIN
      ? `${trimmed.length}/${MAX} (at least ${MIN} characters)`
      : `${trimmed.length}/${MAX}`;

  return (
    <Stack gap={spacing.xl}>
      <Stack row align="center" gap={spacing.md}>
        <Avatar uri={single?.photo_url} name={single?.first_name} size={56} />
        <View style={{ flex: 1 }}>
          <Title>Vouch for {firstName}</Title>
        </View>
      </Stack>

      <Stack gap={spacing.xs}>
        <Heading>{promptText}</Heading>
        <Caption>
          {existing ? 'The prompt you answered.' : "This week's prompt. New one next week."}
        </Caption>
      </Stack>

      <Field
        multiline
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX))}
        maxLength={MAX}
        placeholder="One honest sentence. It's shown to the match word for word, under your name."
        hint={counter}
      />

      <Field
        label="How do you know each other?"
        value={howKnown}
        onChangeText={setHowKnown}
        maxLength={120}
        placeholder="Flatmates in 2012, work, my sister's friend"
      />

      {error ? <Caption color={colors.danger}>{error}</Caption> : null}

      <Stack gap={spacing.sm}>
        <Button
          title="Save vouch"
          onPress={save}
          loading={saving}
          disabled={!canSave || removing}
        />
        {existing ? (
          <Button
            title="Remove my vouch"
            variant="ghost"
            onPress={confirmRemove}
            loading={removing}
            disabled={saving}
          />
        ) : null}
      </Stack>
    </Stack>
  );
}
