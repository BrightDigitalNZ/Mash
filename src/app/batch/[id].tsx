// One batch, two seats. The Catch gets the reveal. The Mashmaker watches it happen.

import { useLocalSearchParams } from 'expo-router';
import React from 'react';

import BackChevron from '@/components/BackChevron';
import BatchReveal from '@/components/BatchReveal';
import BatchWatch from '@/components/BatchWatch';
import { Empty, ErrorView, Loading, Screen } from '@/components/ui';
import { useBatch } from '@/hooks/useData';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';

export default function BatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession((s) => s.session?.user.id);
  const q = useBatch(id);

  if (q.isLoading) {
    return (
      <Screen>
        <BackChevron />
        <Loading />
      </Screen>
    );
  }
  if (q.isError) {
    return (
      <Screen>
        <BackChevron />
        <ErrorView message={copy.errors.didNotLoad} onRetry={() => q.refetch()} />
      </Screen>
    );
  }
  const batch = q.data;
  if (!batch || !me) {
    return (
      <Screen>
        <BackChevron />
        <Empty title="This batch isn’t here." body="It may have been closed." />
      </Screen>
    );
  }
  if (batch.catch.id === me) return <BatchReveal batch={batch} me={me} />;
  if (batch.mashmaker.id === me) return <BatchWatch batch={batch} me={me} />;
  return (
    <Screen>
      <BackChevron />
      <Empty
        title="Not yours to see."
        body="A batch is only for the Catch and the Mashmaker who made it."
      />
    </Screen>
  );
}
