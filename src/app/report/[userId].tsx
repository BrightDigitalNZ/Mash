// Report someone. Goes to us, never to a Mashmaker. The reporter chooses what their
// Mashmaker learns. Calm, specific, action first.

import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Heading,
  Label,
  Loading,
  Screen,
  Stack,
} from '@/components/ui';
import { keys, useProfile } from '@/hooks/useData';
import { blockUser, reportUser } from '@/lib/api';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { ShareLevel } from '@/types/database';

const REASONS = [
  'Asked for money',
  'Pressure or moving fast',
  'Not who they said',
  'Harassment',
  'Something else',
] as const;

const SHARE: { value: ShareLevel; label: string; explain: string }[] = [
  { value: 'nothing', label: 'Nothing', explain: 'Your Mashmaker is not told anything.' },
  {
    value: 'met',
    label: 'That I reported',
    explain: 'Your Mashmaker learns you made a report, not who or why.',
  },
  { value: 'details', label: 'Details', explain: 'Your Mashmaker learns who and what.' },
];

export default function ReportScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useSession((s) => s.session?.user.id);
  const qc = useQueryClient();
  const person = useProfile(userId);

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [share, setShare] = useState<ShareLevel>('nothing');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = person.data?.first_name ?? 'this person';
  const shareExplain = SHARE.find((s) => s.value === share)?.explain ?? '';

  const send = async () => {
    if (!me || !userId || !reason) return;
    setSending(true);
    setError(null);
    try {
      await reportUser({
        reporterId: me,
        reportedId: userId,
        reason,
        details: details.trim() || undefined,
        share,
      });
      setSent(true);
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setSending(false);
    }
  };

  const block = async () => {
    if (!me || !userId) return;
    setBlocking(true);
    setError(null);
    try {
      await blockUser(me, userId);
      setBlocked(true);
      qc.invalidateQueries({ queryKey: keys.mashes });
      qc.invalidateQueries({ queryKey: keys.batches });
    } catch {
      setError(copy.errors.didNotSend);
    } finally {
      setBlocking(false);
    }
  };

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

      {person.isLoading ? (
        <Loading />
      ) : sent ? (
        <Stack gap={spacing.xl}>
          <Heading>Thanks. A person reads every report.</Heading>
          <Body color={colors.textSecondary}>
            Their open intros are paused while we look, not cancelled.
          </Body>
          {blocked ? (
            <Body>{copy.safety.blocked}</Body>
          ) : (
            <Button
              title={`Block ${name} too`}
              variant="ghost"
              onPress={block}
              loading={blocking}
              accessibilityLabel={`Block ${name} too`}
            />
          )}
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button title="Done" onPress={() => router.back()} />
        </Stack>
      ) : (
        <Stack gap={spacing.xl}>
          <Heading>Report {name}</Heading>

          <Stack gap={spacing.sm}>
            <Label>What happened</Label>
            <Stack row wrap gap={spacing.sm}>
              {REASONS.map((r) => (
                <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
              ))}
            </Stack>
          </Stack>

          <Field
            label="Anything that helps"
            multiline
            value={details}
            onChangeText={setDetails}
            maxLength={1000}
            placeholder="What they said or did. In your words."
          />

          <Stack gap={spacing.sm}>
            <Label>What should your Mashmaker learn?</Label>
            <Stack row wrap gap={spacing.sm}>
              {SHARE.map((s) => (
                <Chip
                  key={s.value}
                  label={s.label}
                  selected={share === s.value}
                  onPress={() => setShare(s.value)}
                />
              ))}
            </Stack>
            <Caption>{shareExplain}</Caption>
          </Stack>

          <Stack gap={spacing.xs}>
            <Caption>{copy.safety.reportGoesToUs}</Caption>
            <Caption>Their open intros are paused while we look, not cancelled.</Caption>
          </Stack>

          {error ? <Caption color={colors.danger}>{error}</Caption> : null}

          <View testID="submit-report">
            <Button
              title="Send report"
              onPress={send}
              loading={sending}
              disabled={!reason}
              accessibilityLabel="Send report"
            />
          </View>
          {!blocked ? (
            <Button
              title={`Block ${name} too`}
              variant="ghost"
              onPress={block}
              loading={blocking}
              accessibilityLabel={`Block ${name} too`}
            />
          ) : (
            <Caption center>{copy.safety.blocked}</Caption>
          )}
        </Stack>
      )}
    </Screen>
  );
}
