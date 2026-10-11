// Single's step two. Five questions, then on to contacts.

import { router } from 'expo-router';
import CriteriaForm from '@/components/CriteriaForm';
import { Body, Loading, Screen, Stack, Title } from '@/components/ui';
import { useCriteria } from '@/hooks/useData';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

export default function CriteriaStep() {
  const userId = useSession((s) => s.session?.user.id);
  const existing = useCriteria(userId);

  if (!userId || existing.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.sm}>
          <Title>What you&apos;re after</Title>
          <Body color={colors.textSecondary}>
            Five questions. The matchmaker uses these to rule people out, not to rank them.
          </Body>
        </Stack>
        <CriteriaForm
          singleId={userId}
          initial={existing.data ?? null}
          saveLabel="Continue"
          onSaved={() => router.replace('/(onboarding)/contacts')}
        />
      </Stack>
    </Screen>
  );
}
