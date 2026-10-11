// Step one: the basics the matchmaker and your friends need. Name and photo come from the
// social login; this is a confirm, not a form to fill from scratch.

import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  Avatar,
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
import { uploadAvatar } from '@/lib/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { CountryCode } from '@/types/database';

const CITIES: { name: string; country: CountryCode }[] = [
  { name: 'Auckland', country: 'NZ' },
  { name: 'Wellington', country: 'NZ' },
  { name: 'Christchurch', country: 'NZ' },
  { name: 'Sydney', country: 'AU' },
  { name: 'Melbourne', country: 'AU' },
  { name: 'Brisbane', country: 'AU' },
];

const MIN_AGE = 18;
const MAX_AGE = 110;

/** Returns an ISO date (YYYY-MM-DD) or an error message. */
function parseDob(dd: string, mm: string, yyyy: string): { iso: string } | { error: string } {
  const d = Number(dd);
  const m = Number(mm);
  const y = Number(yyyy);
  if (
    !dd ||
    !mm ||
    !yyyy ||
    !Number.isInteger(d) ||
    !Number.isInteger(m) ||
    !Number.isInteger(y) ||
    yyyy.length !== 4
  ) {
    return { error: 'Enter your date of birth as day, month and year.' };
  }
  const date = new Date(y, m - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!real) return { error: 'That date does not exist.' };

  const now = new Date();
  let age = now.getFullYear() - y;
  const beforeBirthday = now.getMonth() < m - 1 || (now.getMonth() === m - 1 && now.getDate() < d);
  if (beforeBirthday) age -= 1;
  if (age < MIN_AGE) return { error: 'Mash is for people 18 and over.' };
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
  const userId = useSession((s) => s.session?.user.id);
  const updateProfile = useSession((s) => s.updateProfile);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(profile?.photo_url ?? null);
  const [[dd0, mm0, yyyy0]] = useState(() => splitDob(profile?.date_of_birth ?? null));
  const [dd, setDd] = useState(dd0);
  const [mm, setMm] = useState(mm0);
  const [yyyy, setYyyy] = useState(yyyy0);

  const presetCity = CITIES.find((c) => c.name === profile?.city);
  const [city, setCity] = useState<string>(presetCity?.name ?? '');
  const [otherCity, setOtherCity] = useState<string>(presetCity ? '' : (profile?.city ?? ''));
  const [otherCountry, setOtherCountry] = useState<CountryCode | null>(
    presetCity ? null : (profile?.country ?? null),
  );

  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    dob?: string;
    city?: string;
    photo?: string;
    save?: string;
  }>({});

  const usingOther = city === '';
  const country: CountryCode | null = useMemo(() => {
    if (!usingOther) return CITIES.find((c) => c.name === city)?.country ?? null;
    return otherCountry;
  }, [city, usingOther, otherCountry]);

  async function changePhoto() {
    if (!userId || photoBusy) return;
    setErrors((e) => ({ ...e, photo: undefined }));
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setErrors((e) => ({
          ...e,
          photo: 'Mash needs photo access to change your picture. You can allow it in Settings.',
        }));
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled) return;
      const uri = res.assets[0]?.uri;
      if (!uri) return;
      setPhotoBusy(true);
      const url = await uploadAvatar(userId, uri);
      setPhotoUrl(url);
    } catch {
      setErrors((e) => ({ ...e, photo: 'That photo did not upload. Try another one.' }));
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save() {
    const next: typeof errors = {};
    const first = firstName.trim();
    if (!first) next.name = 'Your first name is what your friends will see.';

    const dob = parseDob(dd.trim(), mm.trim(), yyyy.trim());
    if ('error' in dob) next.dob = dob.error;

    const finalCity = usingOther ? otherCity.trim() : city;
    if (!finalCity) next.city = 'Pick a city, or tell us where you are.';
    else if (!country) next.city = 'Is that in New Zealand or Australia?';

    setErrors(next);
    if (Object.keys(next).length > 0 || 'error' in dob || !country) return;

    setSaving(true);
    try {
      await updateProfile({
        first_name: first,
        last_name: lastName.trim(),
        date_of_birth: dob.iso,
        city: finalCity,
        country,
        photo_url: photoUrl,
      });
      router.replace('/(onboarding)/role');
    } catch {
      setErrors({ save: 'That did not save. Check your connection and try again.' });
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
              <Title>Confirm the basics</Title>
              <Body color={colors.textSecondary}>
                Your friends see your first name and photo. The rest stays between you and the
                matchmaker.
              </Body>
            </Stack>

            <Pressable
              onPress={changePhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Avatar uri={photoUrl} name={firstName || profile?.first_name} size={72} ring />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Body>
                  {photoBusy ? 'Uploading...' : photoUrl ? 'Change photo' : 'Add a photo'}
                </Body>
                <Caption>A clear one of your face. Your friends will recognise you anyway.</Caption>
                {errors.photo ? <Caption color={colors.danger}>{errors.photo}</Caption> : null}
              </View>
            </Pressable>

            <Stack gap={spacing.md}>
              <Field
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                error={errors.name}
              />
              <Field
                label="Last name"
                hint="Never shown to anyone. Helps friends tell you apart from other people with your name."
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
              />
            </Stack>

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
                <Caption>Only your age is ever shown.</Caption>
              )}
            </Stack>

            <Stack gap={spacing.sm}>
              <Label>City</Label>
              <Stack row wrap gap={spacing.sm}>
                {CITIES.map((c) => (
                  <Chip
                    key={c.name}
                    label={c.name}
                    selected={city === c.name}
                    onPress={() => {
                      setCity(c.name);
                      setErrors((e) => ({ ...e, city: undefined }));
                    }}
                  />
                ))}
              </Stack>
              <Field
                label="Somewhere else"
                placeholder="Your town or city"
                value={otherCity}
                onChangeText={(t) => {
                  setOtherCity(t);
                  if (t.trim()) setCity('');
                  setErrors((e) => ({ ...e, city: undefined }));
                }}
                onFocus={() => setCity('')}
                autoCapitalize="words"
              />
              {usingOther && otherCity.trim() ? (
                <Stack row gap={spacing.sm} align="center">
                  <Caption>Country</Caption>
                  <Chip
                    label="NZ"
                    selected={otherCountry === 'NZ'}
                    onPress={() => setOtherCountry('NZ')}
                  />
                  <Chip
                    label="AU"
                    selected={otherCountry === 'AU'}
                    onPress={() => setOtherCountry('AU')}
                  />
                </Stack>
              ) : null}
              {errors.city ? <Caption color={colors.danger}>{errors.city}</Caption> : null}
            </Stack>
          </Stack>
        </ScrollView>
        <Footer>
          {errors.save ? <Caption color={colors.danger}>{errors.save}</Caption> : null}
          <Button title="Continue" onPress={save} loading={saving} disabled={photoBusy} />
        </Footer>
      </KeyboardAvoidingView>
    </Screen>
  );
}
