// The front door. Identity only: no friend graph, no contacts yet, nothing until they say so.

import {
  AppleAuthenticationButton,
  AppleAuthenticationButtonStyle,
  AppleAuthenticationButtonType,
} from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Display, Heading, Screen, Stack } from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { isAppleAvailable, signIn, type Provider } from '@/lib/auth';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { enterDemo, useSession } from '@/store/session';
import { colors, palette, spacing } from '@/theme';

function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cancel/i.test(msg)) return 'Sign in was cancelled.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return 'Sign in didn’t work. Try again, or use a different account.';
}

/** The auth listener in the session store catches up a beat after signIn resolves. */
async function waitForSession(): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    if (useSession.getState().session) return;
    await new Promise((r) => setTimeout(r, 100));
  }
}

export default function Welcome() {
  const [appleReady, setAppleReady] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    isAppleAvailable()
      .then((ok) => {
        if (alive) setAppleReady(ok);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function go(provider: Provider) {
    if (busy) return;
    setBusy(provider);
    setError(null);
    try {
      await signIn(provider);
      track(Events.signedIn, { provider });
      await waitForSession();
      await useSession.getState().refreshProfile();
      router.replace('/');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  }

  function demoAs(persona: 'tin' | 'holly') {
    enterDemo(persona);
    router.replace('/');
  }

  return (
    <Screen dark scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <Stack gap={spacing.lg} style={{ paddingTop: spacing.xxxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Display color={colors.textInverse}>{copy.app}</Display>
            <View
              accessible={false}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: colors.accent,
                marginLeft: 4,
                marginBottom: 10,
              }}
            />
          </View>
          <Heading color={colors.textInverse}>{copy.tagline}</Heading>
          <Body color={palette.plum300}>{copy.oneLine}</Body>
        </Stack>

        {DEMO ? (
          <Stack gap={spacing.md}>
            <Caption center color={palette.plum300}>
              A walk-through with sample people. Nothing here is real.
            </Caption>
            <Button
              title="Tin, a Catch"
              variant="accent"
              onPress={() => demoAs('tin')}
              accessibilityLabel="See Mash as Tin, a Catch"
            />
            <Button
              title="Holly, a Mashmaker"
              variant="inverse"
              onPress={() => demoAs('holly')}
              accessibilityLabel="See Mash as Holly, a Mashmaker"
            />
            <Caption center color={palette.plum300} style={{ marginTop: spacing.sm }}>
              Sign out from Settings to switch.
            </Caption>
          </Stack>
        ) : (
          <Stack gap={spacing.md}>
            {appleReady ? (
              <AppleAuthenticationButton
                buttonType={AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={26}
                style={{ height: 52, width: '100%', opacity: busy && busy !== 'apple' ? 0.5 : 1 }}
                onPress={() => go('apple')}
              />
            ) : null}
            <Button
              title="Continue with Google"
              variant="inverse"
              loading={busy === 'google'}
              disabled={!!busy && busy !== 'google'}
              onPress={() => go('google')}
            />
            <Button
              title="Continue with Facebook"
              variant="inverse"
              loading={busy === 'facebook'}
              disabled={!!busy && busy !== 'facebook'}
              onPress={() => go('facebook')}
            />
            {error ? (
              <Caption color={colors.danger} center>
                {error}
              </Caption>
            ) : null}
            <Caption center color={palette.plum300} style={{ marginTop: spacing.sm }}>
              Sign in is for identity only. We never ask for your friend list.
            </Caption>
          </Stack>
        )}
      </View>
    </Screen>
  );
}
