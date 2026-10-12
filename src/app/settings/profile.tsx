// Who you are, in your own words. Gender and who you'd like to meet are private inputs for the
// Machine, never a badge or a filter anyone else sees. Verification keeps a result, not a document.

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import {
  Avatar,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Field,
  Heading,
  Label,
  Screen,
  Stack,
} from '@/components/ui';
import { useAppSettings } from '@/hooks/useData';
import { uploadAvatar } from '@/lib/api';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { CountryCode, GenderKind } from '@/types/database';

const CITIES = [
  'Auckland',
  'Wellington',
  'Christchurch',
  'Sydney',
  'Melbourne',
  'Brisbane',
] as const;
const CITY_COUNTRY: Record<(typeof CITIES)[number], CountryCode> = {
  Auckland: 'NZ',
  Wellington: 'NZ',
  Christchurch: 'NZ',
  Sydney: 'AU',
  Melbourne: 'AU',
  Brisbane: 'AU',
};
const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: 'NZ', label: 'New Zealand' },
  { code: 'AU', label: 'Australia' },
];
const GENDERS: { value: GenderKind; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];
const SEEKING = GENDERS.filter((g) => g.value !== 'prefer_not_to_say');
const BIO_MAX = 200;

const isPreset = (c: string): c is (typeof CITIES)[number] =>
  (CITIES as readonly string[]).includes(c);

export default function ProfileScreen() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const me = useSession((s) => s.session?.user.id);
  const settings = useAppSettings();

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [country, setCountry] = useState<CountryCode>(profile?.country ?? 'NZ');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [gender, setGender] = useState<GenderKind | null>(profile?.gender ?? null);
  const [seeking, setSeeking] = useState<GenderKind[]>(profile?.seeking ?? []);
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canPickPhoto = !DEMO && Platform.OS !== 'web';
  const canSave = firstName.trim().length > 0 && city.trim().length > 0;

  const pickCity = (c: (typeof CITIES)[number]) => {
    setCity(c);
    setCountry(CITY_COUNTRY[c]);
  };

  const toggleSeeking = (g: GenderKind) =>
    setSeeking((list) => (list.includes(g) ? list.filter((x) => x !== g) : [...list, g]));

  const pickPhoto = async () => {
    if (!me || !canPickPhoto) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (result.canceled || !asset) return;
      setUploading(true);
      const url = await uploadAvatar(me, asset.uri);
      setPhotoUrl(url);
      await updateProfile({ photo_url: url });
    } catch {
      setError('That photo didn’t upload. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        first_name: firstName.trim(),
        city: city.trim(),
        country,
        bio: bio.trim() || null,
        gender,
        seeking,
      });
      router.back();
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setSaving(false);
    }
  };

  const verified = !!profile?.verified_identity;
  const photosCurrent = !!profile?.photos_current;
  const retentionDays = settings.data?.verification_image_retention_days ?? '7';
  const mode = settings.data?.verification_mode ?? 'liveness';
  const modeLine =
    mode === 'liveness'
      ? 'A liveness check. A short clip of you, read by the Machine, then deleted.'
      : 'A photo check. One photo of you, read by the Machine, then deleted.';

  const verifyNow = async () => {
    if (!DEMO) {
      setVerifyNotice('Verification arrives with the TestFlight build.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await updateProfile({
        verified_identity: true,
        photos_current: true,
        verified_at: new Date().toISOString(),
      });
    } catch {
      setError(copy.errors.didNotSave);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Stack row align="center" gap={spacing.lg}>
          {canPickPhoto ? (
            <Pressable
              onPress={pickPhoto}
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              disabled={uploading}
            >
              <Avatar uri={photoUrl} name={firstName} size={88} />
            </Pressable>
          ) : (
            <Avatar uri={photoUrl} name={firstName} size={88} />
          )}
          <View style={{ flex: 1 }}>
            {canPickPhoto ? (
              <Button
                title="Change photo"
                variant="secondary"
                full={false}
                small
                loading={uploading}
                onPress={pickPhoto}
              />
            ) : (
              <Caption>Photos change on your phone.</Caption>
            )}
          </View>
        </Stack>

        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          maxLength={60}
        />

        <Stack gap={spacing.sm}>
          <Label>City</Label>
          <Stack row wrap gap={spacing.sm}>
            {CITIES.map((c) => (
              <Chip key={c} label={c} selected={city === c} onPress={() => pickCity(c)} />
            ))}
          </Stack>
          <Field
            value={isPreset(city) ? '' : city}
            onChangeText={setCity}
            placeholder="Somewhere else"
            autoCapitalize="words"
            maxLength={60}
            accessibilityLabel="Another city"
          />
        </Stack>

        <Stack gap={spacing.sm}>
          <Label>Country</Label>
          <Stack row wrap gap={spacing.sm}>
            {COUNTRIES.map((c) => (
              <Chip
                key={c.code}
                label={c.label}
                selected={country === c.code}
                onPress={() => setCountry(c.code)}
              />
            ))}
          </Stack>
        </Stack>

        <Field
          label="About you"
          multiline
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
          maxLength={BIO_MAX}
          placeholder="A line or two in your own words."
          hint={`${bio.length}/${BIO_MAX}`}
        />

        <Stack gap={spacing.sm}>
          <Label>You are</Label>
          <Stack row wrap gap={spacing.sm}>
            {GENDERS.map((g) => (
              <Chip
                key={g.value}
                label={g.label}
                selected={gender === g.value}
                onPress={() => setGender(g.value)}
              />
            ))}
          </Stack>
        </Stack>

        <Stack gap={spacing.sm}>
          <Label>Who you want to meet</Label>
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
          <Caption>Never shown as a badge or a filter to others.</Caption>
        </Stack>

        <Card tone="alt">
          <Heading>Verification</Heading>
          <CheckLine
            ok={verified}
            label={verified ? 'Identity verified' : 'Identity not verified yet'}
          />
          <CheckLine
            ok={photosCurrent}
            label={photosCurrent ? 'Photos checked current' : 'Photos not checked yet'}
          />
          <Caption>
            We keep the result, not the document. Verification images are deleted within{' '}
            {retentionDays} days.
          </Caption>
          {!verified || !photosCurrent ? (
            <Stack gap={spacing.sm}>
              <Caption>{modeLine}</Caption>
              <Button
                title="Verify now"
                variant="secondary"
                full={false}
                small
                onPress={verifyNow}
                loading={verifying}
              />
              {verifyNotice ? <Caption>{verifyNotice}</Caption> : null}
            </Stack>
          ) : null}
        </Card>

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}

        <Button title="Save" onPress={save} loading={saving} disabled={!canSave || uploading} />
      </Stack>
    </Screen>
  );
}

function CheckLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Stack row align="center" gap={spacing.sm}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={ok ? colors.accent : colors.textMuted}
      />
      <Body>{label}</Body>
    </Stack>
  );
}
