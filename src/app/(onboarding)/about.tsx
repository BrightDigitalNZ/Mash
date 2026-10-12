// Step one: the basics. Name comes from the sign-in; this is a confirm, not a form from scratch.
// Gender and who you'd like to meet go only to your Mashmakers. Never a badge, never a filter.

import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';

import {
  Body,
  Button,
  Caption,
  Chip,
  Field,
  Footer,
  Label,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { copy } from '@/lib/copy';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { CountryCode, GenderKind } from '@/types/database';

const MIN_AGE = 18;
const MAX_AGE = 110;

const GENDERS: { label: string; value: GenderKind }[] = [
  { label: 'Woman', value: 'woman' },
  { label: 'Man', value: 'man' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const SEEKING: { label: string; value: GenderKind }[] = [
  { label: 'Women', value: 'woman' },
  { label: 'Men', value: 'man' },
  { label: 'Non-binary people', value: 'non_binary' },
];

/** Returns an ISO date (YYYY-MM-DD) or a short message. */
function parseDob(dd: string, mm: string, yyyy: string): { iso: string } | { error: string } {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (!dd || !mm || !yyyy || !Number.isInteger(d) || !Number.isInteger(m) || yyyy.length !== 4) {
    return { error: 'Enter your date of birth as day, month and year.' };
  }
  const date = new Date(y, m - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!real) return { error: 'That date doesn’t exist.' };

  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  if (age < MIN_AGE) return { error: 'Mash is for adults.' };
  if (age > MAX_AGE) return { error: 'Check the year.' };

  const pad = (n: number) => String(n).padStart(2, '0');
  return { iso: `${y}-${pad(m)}-${pad(d)}` };
}

function splitDob(iso: string | null): [string, string, string] {
  if (!iso) return ['', '', ''];
  const [y = '', m = '', d = ''] = iso.split('-');
  return [d, m, y];
}

export default function About() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [[dd0, mm0, yyyy0]] = useState(() => splitDob(profile?.date_of_birth ?? null));
  const [dd, setDd] = useState(dd0);
  const [mm, setMm] = useState(mm0);
  const [yyyy, setYyyy] = useState(yyyy0);
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState<CountryCode | null>(profile?.country ?? null);
  const [gender, setGender] = useState<GenderKind | null>(profile?.gender ?? null);
  const [seeking, setSeeking] = useState<GenderKind[]>(profile?.seeking ?? []);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    dob?: string;
    city?: string;
    country?: string;
    save?: string;
  }>({});

  function toggleSeeking(value: GenderKind) {
    setSeeking((list) =>
      list.includes(value) ? list.filter((g) => g !== value) : [...list, value],
    );
  }

  async function save() {
    const next: typeof errors = {};
    const first = firstName.trim();
    if (!first) next.name = 'Your first name is what your friends see.';
    const dob = parseDob(dd.trim(), mm.trim(), yyyy.trim());
    if ('error' in dob) next.dob = dob.error;
    if (!city.trim()) next.city = 'Where are you? A city or a town is enough.';
    if (!country) next.country = 'New Zealand or Australia?';

    setErrors(next);
    if (Object.keys(next).length > 0 || 'error' in dob || !country) return;

    setSaving(true);
    try {
      await updateProfile({
        first_name: first,
        date_of_birth: dob.iso,
        city: city.trim(),
        country,
        gender,
        seeking,
      });
      router.replace('/(onboarding)/role');
    } catch {
      setErrors({ save: copy.errors.didNotSave });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Stack gap={spacing.xl}>
            <Stack gap={spacing.sm}>
              <Title>About you</Title>
              <Body color={colors.textSecondary}>
                Your friends see your first name and photo. The rest stays with you and your
                Mashmakers.
              </Body>
            </Stack>

            <Field
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              error={errors.name}
            />

            <Stack gap={spacing.xs}>
              <Label>Date of birth</Label>
              <Stack row gap={spacing.sm}>
                <Field
                  style={{ flex: 1 }}
                  placeholder="DD"
                  value={dd}
                  onChangeText={(t) => setDd(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel="Day of birth"
                />
                <Field
                  style={{ flex: 1 }}
                  placeholder="MM"
                  value={mm}
                  onChangeText={(t) => setMm(t.replace(/\D/g, '').slice(0, 2))}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel="Month of birth"
                />
                <Field
                  style={{ flex: 1.6 }}
                  placeholder="YYYY"
                  value={yyyy}
                  onChangeText={(t) => setYyyy(t.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="number-pad"
                  maxLength={4}
                  accessibilityLabel="Year of birth"
                />
              </Stack>
              {errors.dob ? (
                <Caption color={colors.danger}>{errors.dob}</Caption>
              ) : (
                <Caption>Mash is for adults. Nobody sees your birthday.</Caption>
              )}
            </Stack>

            <Field
              label="City"
              placeholder="Where you live"
              value={city}
              onChangeText={(t) => {
                setCity(t);
                setErrors((e) => ({ ...e, city: undefined }));
              }}
              autoCapitalize="words"
              error={errors.city}
            />

            <Stack gap={spacing.sm}>
              <Label>Country</Label>
              <Stack row gap={spacing.sm}>
                <Chip
                  label="New Zealand"
                  selected={country === 'NZ'}
                  onPress={() => {
                    setCountry('NZ');
                    setErrors((e) => ({ ...e, country: undefined }));
                  }}
                />
                <Chip
                  label="Australia"
                  selected={country === 'AU'}
                  onPress={() => {
                    setCountry('AU');
                    setErrors((e) => ({ ...e, country: undefined }));
                  }}
                />
              </Stack>
              {errors.country ? <Caption color={colors.danger}>{errors.country}</Caption> : null}
            </Stack>

            <Stack gap={spacing.sm}>
              <Label>You are</Label>
              <Stack row wrap gap={spacing.sm}>
                {GENDERS.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    selected={gender === g.value}
                    onPress={() => setGender(gender === g.value ? null : g.value)}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack gap={spacing.sm}>
              <Label>Who would you like to meet?</Label>
              <Stack row wrap gap={spacing.sm}>
                {SEEKING.map((g) => (
                  <Chip
                    key={g.value}
                    label={g.label}
                    selected={seeking.includes(g.value)}
                    onPress={() => toggleSeeking(g.value)}
                  />
                ))}
              </Stack>
              <Caption>
                Only your Mashmakers see what you are looking for. Nobody sees this as a badge or a
                filter. If you’re here to mash, not to be mashed, leave it blank.
              </Caption>
            </Stack>
          </Stack>
        </ScrollView>
        <Footer>
          {errors.save ? <Caption color={colors.danger}>{errors.save}</Caption> : null}
          <Button title="Continue" onPress={save} loading={saving} />
        </Footer>
      </KeyboardAvoidingView>
    </Screen>
  );
}
