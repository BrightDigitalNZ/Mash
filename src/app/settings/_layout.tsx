import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="criteria" options={{ title: "What you're after" }} />
      <Stack.Screen name="linked" options={{ title: 'Linked profiles' }} />
      <Stack.Screen name="plus" options={{ title: 'Mash Plus' }} />
    </Stack>
  );
}
