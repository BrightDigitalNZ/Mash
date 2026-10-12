// The rules for the role, their words, unchanged. Accepted once at onboarding; readable again
// from Settings, where they are shown as already accepted.

import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Body, Button, Caption, Footer, Screen, Stack, Text, Title } from '@/components/ui';
import { CATCH_RULES, MASHMAKER_RULES, copy } from '@/lib/copy';
import { homeFor, useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

export default function Rules() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = profile?.role ?? null;
  if (!role) return <Redirect href="/(onboarding)/role" />;

  const isCatch = role === 'catch';
  const set = isCatch ? CATCH_RULES : MASHMAKER_RULES;
  const acceptedAt = isCatch
    ? profile?.catch_rules_accepted_at
    : profile?.mashmaker_rules_accepted_at;
  const accepted = !!acceptedAt;

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const at = new Date().toISOString();
      const updated = await updateProfile(
        isCatch ? { catch_rules_accepted_at: at } : { mashmaker_rules_accepted_at: at },
      );
      router.replace(homeFor(updated) as never);
    } catch {
      setError(copy.errors.didNotSave);
      setBusy(false);
    }
  }

  function done() {
    if (router.canGoBack()) router.back();
    else router.replace(homeFor(profile) as never);
  }

  return (
    <Screen scroll={false} padded={false}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Stack gap={spacing.xl}>
          <Stack gap={spacing.sm}>
            <Title>{isCatch ? 'The Catch rules' : 'The Mashmaker rules'}</Title>
            <Body color={colors.textSecondary}>{set.intro}</Body>
          </Stack>

          <Stack gap={spacing.lg}>
            {set.rules.map((rule, i) => (
              <View key={rule.title} style={{ flexDirection: 'row', gap: spacing.md }}>
                <Text variant="bodyStrong" color={colors.textMuted} style={{ width: 28 }}>
                  {i + 1}
                </Text>
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{rule.title}</Text>
                  <Body color={colors.textSecondary}>{rule.body}</Body>
                </Stack>
              </View>
            ))}
          </Stack>

          <Body>{set.outro}</Body>
        </Stack>
      </ScrollView>
      <Footer>
        {error ? <Caption color={colors.danger}>{error}</Caption> : null}
        {accepted ? (
          <>
            <Caption center>Accepted.</Caption>
            <Button title="Done" onPress={done} />
          </>
        ) : (
          <Button title="I accept" onPress={accept} loading={busy} />
        )}
      </Footer>
    </Screen>
  );
}
