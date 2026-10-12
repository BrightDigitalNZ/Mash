// A back chevron that falls back to the signed-in person's home when there is no history
// (deep links from a notification land here with nothing behind them).

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable } from 'react-native';

import { homeFor, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { Profile } from '@/types/database';

export function backOrHome(profile: Profile | null) {
  if (router.canGoBack()) router.back();
  else router.replace(homeFor(profile) as never);
}

export default function BackChevron() {
  const profile = useSession((s) => s.profile);
  return (
    <Pressable
      onPress={() => backOrHome(profile)}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={({ pressed }) => [
        { alignSelf: 'flex-start', paddingVertical: spacing.sm },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name="chevron-back" size={28} color={colors.primary} />
    </Pressable>
  );
}
