// Catch only. What you're after, then a separate yes to being matched at all.
// Being on Mash and being matched are two different yeses. This screen holds the second one.

import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import CriteriaForm from '@/components/CriteriaForm';
import {
  Body,
  Button,
  Caption,
  Card,
  Divider,
  Heading,
  Loading,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { keys, useCriteria } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, palette, spacing } from '@/theme';

const NEXT = '/(onboarding)/contacts';

export default function OnboardingCriteria() {
  const profile = useSession((s) => s.profile);
  const userId = useSession((s) => s.session?.user.id);
  const updateProfile = useSession((s) => s.updateProfile);
  const qc = useQueryClient();
  const criteria = useCriteria(userId);

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (profile && profile.role !== 'catch') return <Redirect href={NEXT} />;
  if (!userId || !profile || criteria.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const haveCriteria = saved || !!criteria.data;

  async function yes() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ open_to_matching: true });
      track(Events.matchingOptedIn);
      router.replace(NEXT);
    } catch {
      setError(copy.errors.didNotSave);
      setBusy(false);
    }
  }

  function notYet() {
    router.replace(NEXT);
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            <Stack gap={spacing.sm}>
              <Title>What you’re after</Title>
              <Body color={colors.textSecondary}>
                Your Mashmakers see this when they pick for you. Nobody else does.
              </Body>
            </Stack>

            <CriteriaForm
              catchId={userId}
              initial={criteria.data ?? null}
              onSaved={() => {
                setSaved(true);
                qc.invalidateQueries({ queryKey: keys.criteria(userId) });
              }}
              saveLabel={haveCriteria ? 'Saved. Save again' : 'Save'}
            />

            <Divider />

            <Card tone="inverse" style={{ padding: spacing.xl, gap: spacing.md }}>
              <Heading color={colors.textInverse}>Match me</Heading>
              <Body color={palette.plum300}>{copy.onboarding.optIn}</Body>
              <Body color={colors.textInverse}>
                Say yes and your Mashmakers can put people in front of you. Until then, nobody can.
              </Body>
              {!haveCriteria ? (
                <Caption color={palette.plum300}>Save what you’re after first.</Caption>
              ) : null}
              {error ? <Caption color={colors.danger}>{error}</Caption> : null}
              <Button
                title="Yes, match me"
                variant="accent"
                onPress={yes}
                loading={busy}
                disabled={!haveCriteria}
                accessibilityLabel="Yes, match me"
              />
            </Card>
            <Stack gap={spacing.sm}>
              <Button title="Not yet" variant="ghost" onPress={notYet} disabled={busy} />
              <Caption center>
                Not yet means nobody can put you forward. Next time you open Mash, it asks again.
              </Caption>
            </Stack>
          </Stack>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
