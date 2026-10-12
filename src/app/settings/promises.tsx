// The public commitments, numbered, word for word from copy.ts.

import { View } from 'react-native';

import { Body, Caption, Heading, Screen, Stack } from '@/components/ui';
import { PROMISES } from '@/lib/copy';
import { colors, spacing } from '@/theme';

export default function PromisesScreen() {
  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Caption>What we hold ourselves to. If we break one, say so and we fix it.</Caption>
        <Stack gap={spacing.lg}>
          {PROMISES.map((line, i) => (
            <Stack key={line} row gap={spacing.md} align="flex-start">
              <View style={{ width: 28 }}>
                <Heading color={colors.accent}>{i + 1}</Heading>
              </View>
              <Body style={{ flex: 1 }}>{line}</Body>
            </Stack>
          ))}
        </Stack>
      </Stack>
    </Screen>
  );
}
