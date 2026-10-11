import { Caption, Empty, ErrorView, ListRow, Loading, Screen, Stack, Title } from '@/components/ui';
import { useRecord } from '@/hooks/useData';
import { spacing } from '@/theme';
import type { RecordRow } from '@/types/database';

/** Plain words for what came of an introduction. No numbers, no verdicts. */
function statusLabel(row: RecordRow): string {
  if (row.latest_outcome === 'together') return 'Together';
  if (row.latest_outcome === 'dating') return 'Dating';
  switch (row.status) {
    case 'pending':
      return 'Waiting';
    case 'mutual':
      return 'Talking';
    case 'met':
      return 'They met';
    case 'closed':
    case 'declined':
      return "Didn't work out";
    default:
      return 'Waiting';
  }
}

export default function Record() {
  const record = useRecord();

  return (
    <Screen>
      <Stack gap={spacing.xs} style={{ marginBottom: spacing.lg }}>
        <Title>Your record</Title>
        <Caption>Only you see this. No numbers on purpose.</Caption>
      </Stack>

      {record.isLoading ? (
        <Loading />
      ) : record.error ? (
        <ErrorView message="Could not load your record." onRetry={() => record.refetch()} />
      ) : (record.data ?? []).length === 0 ? (
        <Empty
          title="Nothing here yet"
          body="Your introductions and what came of them will live here."
        />
      ) : (
        <Stack gap={0}>
          {(record.data ?? []).map((row) => (
            <ListRow
              key={row.intro_id}
              title={`${row.single_first_name} and ${row.candidate_first_name}`}
              subtitle={statusLabel(row)}
            />
          ))}
        </Stack>
      )}
    </Screen>
  );
}
