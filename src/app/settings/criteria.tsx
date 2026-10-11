import { router } from 'expo-router';

import CriteriaForm from '@/components/CriteriaForm';
import { ErrorView, Loading, Screen } from '@/components/ui';
import { useCriteria } from '@/hooks/useData';
import { useSession } from '@/store/session';

export default function CriteriaSettings() {
  const me = useSession((s) => s.session?.user.id);
  const criteria = useCriteria(me);

  if (!me || criteria.isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (criteria.error) {
    return (
      <Screen>
        <ErrorView message="Could not load what you're after." onRetry={() => criteria.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <CriteriaForm singleId={me} initial={criteria.data ?? null} onSaved={() => router.back()} />
    </Screen>
  );
}
