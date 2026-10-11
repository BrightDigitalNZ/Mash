// Push is for one thing: a friend acted. "Holly has a lineup for you." Never a nag.

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask once, register the Expo push token against the signed-in user.
 * Returns the token or null when running on a simulator or permission was declined.
 */
export async function registerForPush(userId: string): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    status = asked.status;
  }
  if (status !== 'granted') return null;

  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  await supabase
    .from('push_tokens')
    .upsert({ user_id: userId, token, platform: Platform.OS }, { onConflict: 'user_id,token' });

  return token;
}

export type PushData = {
  route?: string;
};

/** Subscribe to taps on notifications. Returns an unsubscribe function. */
export function onNotificationTap(handler: (data: PushData) => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as PushData | undefined;
    handler(data ?? {});
  });
  return () => sub.remove();
}

/** If the app was opened from a notification, return its data once. */
export async function getInitialNotificationData(): Promise<PushData | null> {
  if (Platform.OS === 'web') return null;
  const last = await Notifications.getLastNotificationResponseAsync();
  const data = last?.notification.request.content.data as PushData | undefined;
  return data ?? null;
}
