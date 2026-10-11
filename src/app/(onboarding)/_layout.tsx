import { Stack } from 'expo-router';

/** Onboarding moves forward only. No swipe-back; each step replaces the last. */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
