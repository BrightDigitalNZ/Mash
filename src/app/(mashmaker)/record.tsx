// The Mashmaker's private record. Status only, and the outcome only at the level the Catch chose.
// No totals, no counts, no badges. On purpose.

import React from 'react';

import { Caption, Empty, ErrorView, ListRow, Loading, Screen, Stack, Title } from '@/components/ui';
import { useRecord } from '@/hooks/useData';
import { copy } from '@/lib/copy';
import { spacing } from '@/theme';
import type { RecordRow } from '@/types/database';
import { outcomeLineForMashmaker } from '../../../supabase/functions/_shared/rules';

/** Plain words for where an introduction is. Never a verdict on a person. */
function statusLine(row: RecordRow): string {
  switch (row.status) {
    case 'pending':
      return 'Asked';
    case 'mutual':
      return 'Both said yes';
    case 'met':
      return 'Met';
    case 'declined':
    case 'closed':
      return copy.decline.didNotGoAhead;
    case 'expired':
      return copy.decline.timedOut;
    default:
      return 'Asked';
  }
}

function outcomeLine(row: RecordRow): string | null {
  if (!row.shared_outcome) return null;
  const share = row.shared_outcome === 'met' ? 'met' : 'details';
  return outcomeLineForMashmaker(share, row.shared_outcome, row.catch_first_name, row.candidate_first_name);
}

export default function Record() {
  const record = useRecord();

  return (
    <Screen>
      <Stack gap={spacing.xs} style={{ marginBottom: spacing.lg }}>
        <Title>Your record</Title>
        <Caption>Private. Only you see this. No counts, no badges.</Caption>
      </Stack>

      {record.isLoading ? (
        <Loading />
      ) : record.error ? (
        <ErrorView message={copy.errors.didNotLoad} onRetry={() => record.refetch()} />
      ) : (record.data ?? []).length === 0 ? (
        <Empty title="Nothing yet" body={copy.empty.record} />
      ) : (
        <Stack gap={0}>
          {(record.data ?? []).map((row) => {
            const outcome = outcomeLine(row);
            return (
              <ListRow
                key={row.mash_id}
                title={`${row.catch_first_name} and ${row.candidate_first_name}`}
                subtitle={outcome ? `${statusLine(row)}. ${outcome}` : statusLine(row)}
              />
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
