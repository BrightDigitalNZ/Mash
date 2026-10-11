import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  Avatar,
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
import { uploadAvatar } from '@/lib/api';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';
import type { CountryCode } from '@/types/database';

const CITIES = [
  'Auckland',
  'Wellington',
  'Christchurch',
  'Sydney',
  'Melbourne',
  'Brisbane',
] as const;

// Moving between the preset cities crosses a border; keep `country` in step with `city`.
const CITY_COUNTRY: Record<(typeof CITIES)[number], CountryCode> = {
  Auckland: 'NZ',
  Wellington: 'NZ',
  Christchurch: 'NZ',
  Sydney: 'AU',
  Melbourne: 'AU',
  Brisbane: 'AU',
};
const BIO_MAX = 240;

export default function ProfileSettings() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const me = useSession((s) => s.session?.user.id);

  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cityIsPreset = (CITIES as readonly string[]).includes(city);

  const pickPhoto = async () => {
    if (!me) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(me, asset.uri);
      setPhotoUrl(url);
      await updateProfile({ photo_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload that photo.');
    } finally {
      setUploading(false);
    }
  };

  const canSave = firstName.trim().length > 0 && city.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const trimmedCity = city.trim();
      const presetCountry = (CITIES as readonly string[]).includes(trimmedCity)
        ? CITY_COUNTRY[trimmedCity as (typeof CITIES)[number]]
        : null;
      await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        city: trimmedCity,
        bio: bio.trim() || null,
        ...(presetCountry ? { country: presetCountry } : {}),
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack row align="center" gap={spacing.lg}>
          <Pressable
            onPress={pickPhoto}
            accessibilityRole="button"
            accessibilityLabel="Change photo"
            disabled={uploading}
          >
            <Avatar uri={photoUrl} name={firstName} size={88} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Button
              title={uploading ? 'Uploading' : 'Change photo'}
              variant="secondary"
              full={false}
              small
              loading={uploading}
              onPress={pickPhoto}
            />
          </View>
        </Stack>

        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          maxLength={60}
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          maxLength={60}
        />

        <Stack gap={spacing.sm}>
          <Label>City</Label>
          <Stack row wrap gap={spacing.sm}>
            {CITIES.map((c) => (
              <Chip key={c} label={c} selected={city === c} onPress={() => setCity(c)} />
            ))}
          </Stack>
          <Field
            value={cityIsPreset ? '' : city}
            onChangeText={setCity}
            placeholder="Somewhere else"
            autoCapitalize="words"
            maxLength={60}
          />
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

        <Card tone="alt">
          <Heading>Photo verification</Heading>
          <Caption>Coming soon. Verified profiles show a tick.</Caption>
        </Card>

        {error ? <Caption color={colors.danger}>{error}</Caption> : null}

        <Button title="Save" onPress={save} loading={saving} disabled={!canSave || uploading} />
      </Stack>
    </Screen>
  );
}
