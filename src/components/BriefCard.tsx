// The Machine's checks on one person, read back plainly. No scores, no numbers.
// Shown only to the person who asked for it. The limitation line is printed every time.

import React from 'react';
import { View } from 'react-native';

import { Body, Caption, Card, Divider, Heading, Label, ListRow, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { BriefContent, LinkedKind } from '@/types/database';

const kindLabel: Record<LinkedKind, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'Website',
  other: 'Link',
};

type Result = BriefContent['consistency'][number]['result'];

const resultWord: Record<Result, string> = {
  consistent: 'Consistent',
  inconsistent: 'Does not match',
  unknown: 'Could not check',
};

const resultColor: Record<Result, string> = {
  consistent: colors.text,
  inconsistent: colors.danger,
  unknown: colors.textMuted,
};

export default function BriefCard({
  content,
  subjectName,
}: {
  content: BriefContent;
  subjectName: string;
}) {
  return (
    <Card>
      <Stack gap={spacing.lg}>
        <Stack gap={spacing.xs}>
          <Heading>The Machine on {subjectName}</Heading>
          <Body>{content.summary}</Body>
        </Stack>

        {content.linked.length > 0 ? (
          <Stack gap={0}>
            <Label>What they linked</Label>
            {content.linked.map((l, i) => (
              <ListRow
                key={`${l.url}-${i}`}
                title={kindLabel[l.kind] ?? 'Link'}
                subtitle={`${l.url}\n${l.what_it_shows}`}
              />
            ))}
          </Stack>
        ) : null}

        {content.consistency.length > 0 ? (
          <Stack gap={spacing.md}>
            <Label>Checks</Label>
            {content.consistency.map((c, i) => (
              <View
                key={`${c.check}-${i}`}
                style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 7,
                    backgroundColor: resultColor[c.result],
                  }}
                  accessibilityLabel={resultWord[c.result]}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{c.check}</Body>
                  <Caption color={resultColor[c.result]}>{resultWord[c.result]}</Caption>
                  {c.note ? <Caption>{c.note}</Caption> : null}
                </View>
              </View>
            ))}
          </Stack>
        ) : null}

        {content.sources.length > 0 ? (
          <Stack gap={spacing.xs}>
            <Divider />
            <Label>Sources</Label>
            {content.sources.map((s, i) => (
              <Caption key={`${s}-${i}`}>{s}</Caption>
            ))}
          </Stack>
        ) : null}

        <Stack gap={spacing.xs}>
          <Divider />
          <Caption color={colors.textSecondary}>{content.limitation}</Caption>
          <Caption>
            Only you can see this. Not {subjectName}, not your Mashmaker. It is deleted when this
            mash closes.
          </Caption>
        </Stack>
      </Stack>
    </Card>
  );
}
