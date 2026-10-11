import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, router, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { posthog } from '@/lib/analytics';
import { getInitialNotificationData, onNotificationTap, registerForPush } from '@/lib/notifications';
import { bootSession, useSession } from '@/store/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

export default function RootLayout() {
  const booting = useSession((s) => s.booting);
  const userId = useSession((s) => s.session?.user.id);

  useEffect(() => bootSession(), []);

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync().catch(() => {});
  }, [booting]);

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
          <Stack.Screen name="(single)" />
          <Stack.Screen name="(voucher)" />
          <Stack.Screen name="lineup/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="intro/[id]" />
          <Stack.Screen name="vouch/[singleId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="nominate/[singleId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report/[userId]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
