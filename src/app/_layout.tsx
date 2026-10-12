import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/bricolage-grotesque';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { posthog } from '@/lib/analytics';
import {
  getInitialNotificationData,
  onNotificationTap,
  registerForPush,
} from '@/lib/notifications';
import { bootSession, useSession } from '@/store/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

export default function RootLayout() {
  const booting = useSession((s) => s.booting);
  const userId = useSession((s) => s.session?.user.id);
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
  });
  const ready = !booting && (fontsLoaded || !!fontError);

  useEffect(() => bootSession(), []);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Push: register once signed in, and route on tap.
  useEffect(() => {
    if (!userId) return;
    registerForPush(userId).catch(() => {});
    getInitialNotificationData().then((data) => {
      if (data?.route) router.push(data.route as never);
    });
    return onNotificationTap((data) => {
      if (data.route) router.push(data.route as never);
    });
  }, [userId]);

  useEffect(() => {
    return () => {
      posthog?.flush().catch(() => {});
    };
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(catch)" />
          <Stack.Screen name="(mashmaker)" />
          <Stack.Screen name="batch/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="mash/[id]" />
          <Stack.Screen name="consent/[batchId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="vouch/[catchId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="nominate/[catchId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report/[userId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
