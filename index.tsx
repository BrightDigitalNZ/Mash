// Custom entry. Identical to expo-router/entry except that the browser demo starts at
// the app's root whatever URL it is hosted on. Native builds are unaffected.

// `@expo/metro-runtime` must be the first import so Fast Refresh works on web.
import '@expo/metro-runtime';

import { ExpoRoot } from 'expo-router';
import { ctx } from 'expo-router/_ctx';
import Head from 'expo-router/head';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import { Platform } from 'react-native';

const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';
// Start at the app's root whatever the page URL is. scripts/build-web-demo.mjs then stops
// the router from writing to the address bar, so the demo can live at any fixed URL.
const location = DEMO && Platform.OS === 'web' ? '/' : undefined;

export function App() {
  return (
    <Head.Provider>
      <ExpoRoot context={ctx} location={location} />
    </Head.Provider>
  );
}

renderRootComponent(App);
