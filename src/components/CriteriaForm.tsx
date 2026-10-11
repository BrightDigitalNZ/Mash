// Five questions, nothing more. Everything else comes from the vouches.
// Used in onboarding and again from settings. Content only: the parent Screen owns scrolling
// and padding, so the save button sits at the end of the form.

import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Body, Button, Caption, Chip, Field, Heading, Stack } from '@/components/ui';
import { saveCriteria } from '@/lib/api';
import { colors, spacing } from '@/theme';
import type { Criteria, IntentKind } from '@/types/database';

const AGE_FLOOR = 18;
const AGE_CEIL = 80;
const DEFAULT_MIN = 30;
const DEFAULT_MAX = 50;
const OPEN_MAX = 200;

const DISTANCES: { label: string; km: number }[] = [
  { label: '10 km', km: 10 },
  { label: '30 km', km: 30 },
  { label: '60 km', km: 60 },
  { label: 'Anywhere in my country', km: 500 },
];

const DEALBREAKERS = [
  'Smoker',
  'Wants kids',
  "Doesn't want kids",
  'Long distance',
  'Not over an ex',
  'Big drinker',
  'No sense of humour',
  'Religion matters',
  'Politics opposite to mine',
];

const INTENTS: { label: string; value: IntentKind }[] = [
  { label: 'A relationship', value: 'relationship' },
  { label: 'See where it goes', value: 'see_where_it_goes' },
  { label: 'Companionship', value: 'companionship' },
  { label: 'Not sure yet', value: 'not_sure' },
];

function clampAge(raw: string, fallback: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(AGE_FLOOR, Math.min(AGE_CEIL, n));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={spacing.md}>
      <Heading>{title}</Heading>
      {children}
    </Stack>
  );
}

export default function CriteriaForm({
  singleId,
  initial,
  onSaved,
  saveLabel = 'Save',
}: {
  singleId: string;
  initial: Criteria | null;
  onSaved: () => void;
  /** Button text. Onboarding says "Continue", settings says "Save". */
  saveLabel?: string;
}) {
  const [ageMin, setAgeMin] = useState(String(initial?.age_min ?? DEFAULT_MIN));
  const [ageMax, setAgeMax] = useState(String(initial?.age_max ?? DEFAULT_MAX));
  const [radius, setRadius] = useState<number>(initial?.radius_km ?? 30);
  const [dealbreakers, setDealbreakers] = useState<string[]>(initial?.dealbreakers ?? []);
  const [custom, setCustom] = useState('');
  const [intent, setIntent] = useState<IntentKind | null>(initial?.intent ?? null);
  const [openText, setOpenText] = useState(initial?.open_text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownDealbreakers = dealbreakers.filter((d) => !DEALBREAKERS.includes(d));

  function toggleDealbreaker(item: string) {
    setDealbreakers((list) =>
      list.includes(item) ? list.filter((d) => d !== item) : [...list, item],
    );
  }

  function addCustom() {
    const text = custom.trim();
    if (!text) return;
    if (!dealbreakers.some((d) => d.toLowerCase() === text.toLowerCase())) {
      setDealbreakers((list) => [...list, text]);
    }
    setCustom('');
  }

  function normaliseAges() {
    let min = clampAge(ageMin, DEFAULT_MIN);
    let max = clampAge(ageMax, DEFAULT_MAX);
    if (min > max) [min, max] = [max, min];
    setAgeMin(String(min));
    setAgeMax(String(max));
    return { min, max };
  }

  async function save() {
    setError(null);
    const { min, max } = normaliseAges();
    if (!intent) {
      setError('Pick what you want this to be. "Not sure yet" is a fine answer.');
      return;
    }
    setSaving(true);
    try {
      await saveCriteria(singleId, {
        age_min: min,
        age_max: max,
        radius_km: radius,
        dealbreakers,
        intent,
        open_text: openText.trim() ? openText.trim().slice(0, OPEN_MAX) : null,
      });
      onSaved();
    } catch {
      setError('That did not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View>
      <Stack gap={spacing.xxl}>
        <Section title="Age range">
          <Stack row gap={spacing.md} align="flex-end">
            <Field
              style={{ flex: 1 }}
              label="From"
              value={ageMin}
              onChangeText={(t) => setAgeMin(t.replace(/\D/g, '').slice(0, 2))}
              onBlur={normaliseAges}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Youngest age"
            />
            <Body color={colors.textMuted} style={{ paddingBottom: spacing.lg }}>
              to
            </Body>
            <Field
              style={{ flex: 1 }}
              label="To"
              value={ageMax}
              onChangeText={(t) => setAgeMax(t.replace(/\D/g, '').slice(0, 2))}
              onBlur={normaliseAges}
              keyboardType="number-pad"
              maxLength={2}
              accessibilityLabel="Oldest age"
            />
          </Stack>
          <Caption>
            Between {AGE_FLOOR} and {AGE_CEIL}.
          </Caption>
        </Section>

        <Section title="Distance">
          <Stack row wrap gap={spacing.sm}>
            {DISTANCES.map((d) => (
              <Chip
                key={d.km}
                label={d.label}
                selected={radius === d.km}
                onPress={() => setRadius(d.km)}
              />
            ))}
          </Stack>
        </Section>

        <Section title="Dealbreakers">
          <Caption>Tap any that apply. Leave them all if nothing is a hard no.</Caption>
          <Stack row wrap gap={spacing.sm}>
            {DEALBREAKERS.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={dealbreakers.includes(d)}
                onPress={() => toggleDealbreaker(d)}
              />
            ))}
            {ownDealbreakers.map((d) => (
              <Chip key={d} label={d} selected onPress={() => toggleDealbreaker(d)} />
            ))}
          </Stack>
          <Field
            label="Add your own"
            placeholder="Something that would end it for you"
            value={custom}
            onChangeText={setCustom}
            onSubmitEditing={addCustom}
            returnKeyType="done"
            maxLength={40}
          />
          {custom.trim() ? (
            <Button title="Add" variant="secondary" small full={false} onPress={addCustom} />
          ) : null}
        </Section>

        <Section title="What do you want this to be?">
          <Stack row wrap gap={spacing.sm}>
            {INTENTS.map((i) => (
              <Chip
                key={i.value}
                label={i.label}
                selected={intent === i.value}
                onPress={() => setIntent(i.value)}
              />
            ))}
          </Stack>
        </Section>

        <Section title="One line for the matchmaker">
          <Field
            multiline
            placeholder="Something your friends would say about what you're after."
            value={openText}
            onChangeText={(t) => setOpenText(t.slice(0, OPEN_MAX))}
            maxLength={OPEN_MAX}
            hint={`${openText.length}/${OPEN_MAX}`}
            accessibilityLabel="One line for the matchmaker"
          />
        </Section>

        <Stack gap={spacing.md}>
          <Caption>
            Everything else the matchmaker works out from your friends&apos; vouches, not a
            questionnaire.
          </Caption>
          {error ? <Caption color={colors.danger}>{error}</Caption> : null}
          <Button title={saveLabel} onPress={save} loading={saving} />
        </Stack>
      </Stack>
    </View>
  );
}
