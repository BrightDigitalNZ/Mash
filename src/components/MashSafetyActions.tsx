// The quiet exits on a mash: close it, block them, report them. Each destructive one asks
// once, inline. Reports go to us, never to a Mashmaker.

import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Caption, Divider, Stack } from '@/components/ui';
import { keys } from '@/hooks/useData';
import { blockUser, closeMash } from '@/lib/api';
import { copy } from '@/lib/copy';
import { colors, spacing } from '@/theme';
import type { PublicProfile } from '@/types/database';

export default function MashSafetyActions({
  mashId,
  me,
  other,
}: {
  mashId: string;
  me: string;
  other: PublicProfile;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState<'close' | 'block' | null>(null);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    if (acting) return;
    setActing(true);
    setError(null);
    try {
      await closeMash(mashId);
      setConfirm(null);
      await qc.invalidateQueries({ queryKey: keys.mash(mashId) });
      qc.invalidateQueries({ queryKey: keys.mashes });
      qc.invalidateQueries({ queryKey: keys.record });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setActing(false);
    }
  }

  async function block() {
    if (acting) return;
    setActing(true);
    setError(null);
    try {
      await blockUser(me, other.id);
      qc.invalidateQueries({ queryKey: keys.mashes });
      qc.invalidateQueries({ queryKey: keys.mash(mashId) });
      router.back();
    } catch {
      setError(copy.errors.didNotSave);
      setActing(false);
    }
  }

  let body: React.ReactNode;
  if (confirm === 'close') {
    body = (
      <Stack gap={spacing.sm}>
        <Caption>They’ll see: {copy.decline.didNotGoAhead}</Caption>
        <Stack row gap={spacing.sm}>
          <View testID="close-mash-confirm">
            <Button
              title="Close it"
              variant="danger"
              small
              full={false}
              loading={acting}
              onPress={close}
            />
          </View>
          <Button
            title="Keep it"
            variant="ghost"
            small
            full={false}
            disabled={acting}
            onPress={() => setConfirm(null)}
          />
        </Stack>
      </Stack>
    );
  } else if (confirm === 'block') {
    body = (
      <Stack gap={spacing.sm}>
        <Caption>
          {other.first_name} won’t be able to see you or reach you, and won’t be put forward for you
          again. They aren’t told.
        </Caption>
        <Stack row gap={spacing.sm}>
          <View testID="block-confirm">
            <Button
              title={`Block ${other.first_name}`}
              variant="danger"
              small
              full={false}
              loading={acting}
              onPress={block}
            />
          </View>
          <Button
            title="Keep"
            variant="ghost"
            small
            full={false}
            disabled={acting}
            onPress={() => setConfirm(null)}
          />
        </Stack>
      </Stack>
    );
  } else {
    body = (
      <Stack row wrap gap={spacing.sm}>
        <View testID="close-mash">
          <Button
            title="Close this mash"
            variant="ghost"
            small
            full={false}
            onPress={() => setConfirm('close')}
          />
        </View>
        <View testID="block">
          <Button
            title="Block"
            variant="danger"
            small
            full={false}
            onPress={() => setConfirm('block')}
          />
        </View>
        <View testID="report">
          <Button
            title="Report"
            variant="ghost"
            small
            full={false}
            onPress={() => router.push(`/report/${other.id}`)}
          />
        </View>
      </Stack>
    );
  }

  return (
    <Stack gap={spacing.md}>
      <Divider />
      {body}
      {error ? <Caption color={colors.danger}>{error}</Caption> : null}
      <Caption>{copy.safety.reportGoesToUs}</Caption>
    </Stack>
  );
}
