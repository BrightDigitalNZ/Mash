// Social login for identity only. Minimum scopes. No friend graph is ever requested.
// Apple is built first because App Store rules require it when any other social login is offered.

import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'apple' | 'google' | 'facebook';

const redirectTo = Linking.createURL('auth/callback');

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

/** Native Sign in with Apple, then exchange the identity token with Supabase. */
export async function signInWithApple(): Promise<void> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error) throw error;

  // Apple only sends the name on the very first sign-in. Save it before it is gone.
  const given = credential.fullName?.givenName;
  const family = credential.fullName?.familyName;
  if (data.user && (given || family)) {
    await supabase
      .from('profiles')
      .update({ first_name: given ?? '', last_name: family ?? '' })
      .eq('id', data.user.id);
  }
}

/** Google and Facebook go through Supabase's hosted OAuth in an auth session (PKCE). */
export async function signInWithOAuth(provider: 'google' | 'facebook'): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === 'facebook' ? 'public_profile,email' : 'openid email profile',
    },
  });
  if (error) throw error;
  if (!data.url) throw new Error('No OAuth URL returned');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') {
    throw new Error('Sign in was cancelled');
  }

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) {
    throw new Error('No authorisation code in callback');
  }
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export async function signIn(provider: Provider): Promise<void> {
  if (provider === 'apple') return signInWithApple();
  return signInWithOAuth(provider);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Irreversible. Removes the auth user, which cascades through every table. */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut();
}
