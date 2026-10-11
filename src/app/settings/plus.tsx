import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import {
  Body,
  Button,
  Caption,
  Card,
  Heading,
  ListRow,
  Screen,
  Stack,
  Title,
} from '@/components/ui';
import { Events, track } from '@/lib/analytics';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type Plan = 'monthly' | 'yearly';

const FEATURES = [
  'The brief on every introduction',
  'A wider circle and more lineups',
  'See who nominated you before you accept',
  'Priority when a friend nominates several people',
  'Pause and resume without losing your circle',
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function PlusScreen() {
  const profile = useSession((s) => s.profile);
  const [plan, setPlan] = useState<Plan>('yearly');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    track(Events.plusViewed);
  }, []);

  /** No store SDK is wired yet. This is where StoreKit will go. */
  const startPurchase = (chosen: Plan) => {
    track(Events.plusStarted, { plan: chosen });
    setNotice('Purchases go live with App Store Connect. See README: Mash Plus.');
  };

  return (
    <Screen>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.xs}>
          <Title>Mash Plus</Title>
          <Body color={colors.textSecondary}>
            One tier. Nothing you already have gets taken away.
          </Body>
        </Stack>

        <Stack gap={0}>
          {FEATURES.map((f) => (
            <ListRow
              key={f}
              title={f}
              left={<Ionicons name="checkmark" size={22} color={colors.success} />}
            />
          ))}
        </Stack>

        {profile?.is_plus ? (
          <Card tone="highlight">
            <Heading>You&apos;re on Mash Plus</Heading>
            {profile.plus_until ? <Caption>Until {formatDate(profile.plus_until)}.</Caption> : null}
          </Card>
        ) : (
          <Stack gap={spacing.md}>
            <PlanCard
              title="Monthly"
              price="NZ$19.99 a month"
              selected={plan === 'monthly'}
              onPress={() => setPlan('monthly')}
            />
            <PlanCard
              title="Yearly"
              price="NZ$99 a year"
              note="Save 59%"
              selected={plan === 'yearly'}
              onPress={() => setPlan('yearly')}
            />
            <Button title="Start Mash Plus" variant="accent" onPress={() => startPurchase(plan)} />
            {notice ? <Caption center>{notice}</Caption> : null}
          </Stack>
        )}

        <Caption center>Vouchers never pay.</Caption>
      </Stack>
    </Screen>
  );
}

function PlanCard({
  title,
  price,
  note,
  selected,
  onPress,
}: {
  title: string;
  price: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Card
      onPress={onPress}
      tone={selected ? 'highlight' : 'surface'}
      style={{ borderWidth: 2, borderColor: selected ? colors.primary : 'transparent' }}
      accessibilityState={{ selected }}
    >
      <Stack row align="center" justify="space-between">
        <Stack gap={2}>
          <Heading>{title}</Heading>
          <Body color={colors.textSecondary}>{price}</Body>
          {note ? <Caption color={colors.success}>{note}</Caption> : null}
        </Stack>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={26}
          color={selected ? colors.primary : colors.textMuted}
        />
      </Stack>
    </Card>
  );
}
