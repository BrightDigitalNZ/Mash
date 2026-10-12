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
import { DEMO } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { enterDemo, useSession } from '@/store/session';
import { colors, palette, spacing } from '@/theme';

function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cancel/i.test(msg)) return 'Sign in was cancelled.';
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return 'Sign in did not work. Try again, or use a different account.';
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
      // The auth listener in the session store catches up asynchronously. Make sure the
      // store has the session and profile before the index route decides where to send us.
      const store = useSession.getState();
      if (!store.session) {
        const { data } = await supabase.auth.getSession();
        store.setSession(data.session);
      }
      await useSession.getState().refreshProfile();
      router.replace('/');
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen dark scroll={false} edges={['top', 'bottom', 'left', 'right']}>
      <View style={{ flex: 1, justifyContent: 'space-between' }}>
        <Stack gap={spacing.lg} style={{ paddingTop: spacing.xxxl }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Display color={colors.textInverse}>Mash</Display>
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
          <Heading color={colors.textInverse}>Dating, but someone&apos;s got your back.</Heading>
          <Body color={palette.plum300}>No randoms, no catfish.</Body>
          <Body color={palette.plum300}>Just singles your people can actually vouch for.</Body>
        </Stack>

        {DEMO ? (
          <Stack gap={spacing.md}>
            <Caption center color={palette.plum300}>
              Demo with sample data. Nothing here is real.
            </Caption>
            <Button
              title="See it as Tin, who is single"
              variant="accent"
              onPress={() => {
                enterDemo('tin');
                router.replace('/');
              }}
            />
            <Button
              title="See it as Holly, who vouches"
              variant="inverse"
              onPress={() => {
                enterDemo('holly');
                router.replace('/');
              }}
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
              18+ only. By continuing you agree to our Terms and Privacy Policy.
            </Caption>
          </Stack>
        )}
      </View>
    </Screen>
  );
}
