import { Stack } from 'expo-router';

import { colors, fonts } from '@/theme';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontFamily: fonts.bold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="criteria" options={{ title: 'What you’re after' }} />
      <Stack.Screen name="visibility" options={{ title: 'What your Mashmakers see' }} />
      <Stack.Screen name="checks" options={{ title: 'The Machine’s checks' }} />
      <Stack.Screen name="exclusions" options={{ title: 'People never to show me' }} />
      <Stack.Screen name="plus" options={{ title: 'Mash Plus' }} />
      <Stack.Screen name="promises" options={{ title: 'What we promise' }} />
    </Stack>
  );
}
