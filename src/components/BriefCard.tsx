// The brief: what a person chose to share, read back plainly. No scores, no numbers.

import React from 'react';
import { View } from 'react-native';

import { Body, Caption, Card, Divider, Label, ListRow, Quote, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';
import type { BriefContent, LinkedKind } from '@/types/database';

const kindLabel: Record<LinkedKind, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'Website',
  other: 'Link',
};

const dotColor: Record<BriefContent['consistency'][number]['result'], string> = {
  consistent: colors.success,
  inconsistent: colors.danger,
  unknown: colors.textMuted,
};

export default function BriefCard({ content, subjectName }: { content: BriefContent; subjectName: string }) {
  return (
    <Card>
      <Stack gap={spacing.lg}>
        <Stack gap={spacing.xs}>
          <Label>About {subjectName}</Label>
          <Body>{content.summary}</Body>
        </Stack>

        {content.vouched_by.length > 0 ? (
          <Stack gap={spacing.md}>
            <Label>Vouched by</Label>
            {content.vouched_by.map((v, i) => (
              <Quote key={`${v.first_name}-${i}`} text={v.text} by={v.first_name} />
            ))}
          </Stack>
        ) : null}

        {content.linked.length > 0 ? (
          <Stack gap={0}>
            <Label>What they linked</Label>
            {content.linked.map((l, i) => (
              <ListRow key={`${l.url}-${i}`} title={kindLabel[l.kind] ?? 'Link'} subtitle={`${l.url}\n${l.what_it_shows}`} />
            ))}
          </Stack>
        ) : null}

        {content.consistency.length > 0 ? (
          <Stack gap={spacing.md}>
            <Label>Checks</Label>
            {content.consistency.map((c, i) => (
              <View key={`${c.check}-${i}`} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 7,
                    backgroundColor: dotColor[c.result],
                  }}
                  accessibilityLabel={c.result}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{c.check}</Body>
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
      </Stack>
    </Card>
  );
}
