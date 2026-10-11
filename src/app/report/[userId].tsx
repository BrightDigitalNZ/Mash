import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Heading,
  Loading,
  Screen,
  Stack,
} from '@/components/ui';
import { useProfile } from '@/hooks/useData';
import { blockUser, reportUser } from '@/lib/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

const REASONS = [
  'Fake profile or photos',
  'Harassment or abuse',
  'Underage',
  'Already in a relationship',
  'Something else',
] as const;

export default function ReportScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const me = useSession((s) => s.session?.user.id);
  const person = useProfile(userId);

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = person.data?.first_name ?? 'this person';

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
      });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your report.');
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not block them.');
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
          <Heading>Thanks. A person reads every report within 24 hours.</Heading>
          {blocked ? (
            <Body color={colors.textSecondary}>
              {firstName} is blocked. They won&apos;t see you or reach you.
            </Body>
          ) : (
            <Button
              title={`Also block ${firstName}`}
              variant="danger"
              onPress={block}
              loading={blocking}
            />
          )}
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button title="Done" onPress={() => router.back()} />
        </Stack>
      ) : (
        <Stack gap={spacing.xl}>
          <Heading>Report {firstName}</Heading>
          <Stack row wrap gap={spacing.sm}>
            {REASONS.map((r) => (
              <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </Stack>
          <Field
            label="Details (optional)"
            multiline
            value={details}
            onChangeText={setDetails}
            maxLength={1000}
            placeholder="Anything that helps the person reading this."
          />
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button title="Send report" onPress={send} loading={sending} disabled={!reason} />
        </Stack>
      )}
    </Screen>
  );
}
