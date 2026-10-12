// Mash Plus. Catches only; Mashmakers are free forever and never see a price.
// No urgency, no countdown, nothing to unlock. Paid buys depth, not more people.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';

import { Body, Button, Caption, Card, Heading, Screen, Stack } from '@/components/ui';
import { trialDaysLeft } from '@/hooks/useData';
import { Events, track } from '@/lib/analytics';
import { PRICING } from '@/lib/api';
import { copy } from '@/lib/copy';
import { DEMO } from '@/lib/demo';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme';

type Plan = 'monthly' | 'quarterly';

const FOOTNOTE = 'Mashmakers are free forever. Paid buys depth, not more people.';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' });
}

export default function PlusScreen() {
  const profile = useSession((s) => s.profile);
  const updateProfile = useSession((s) => s.updateProfile);
  const [plan, setPlan] = useState<Plan>('monthly');
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    track(Events.plusViewed);
  }, []);

  if (profile?.role !== 'catch') {
    return (
      <Screen edges={['left', 'right']}>
        <Stack gap={spacing.md}>
          <Heading>Mashmakers are free forever.</Heading>
          <Body color={colors.textSecondary}>There is nothing here for you to pay for.</Body>
        </Stack>
      </Screen>
    );
  }

  const days = trialDaysLeft(profile);
  const trialLine = profile.is_plus
    ? null
    : days === null
      ? copy.plus.trialStartsAtFirstBatch
      : days === 0
        ? 'Your free 21 days are over.'
        : copy.plus.trial(days);

  /** No store SDK is wired yet. In the demo the switch flips straight away. */
  const start = async () => {
    track(Events.plusStarted, { plan });
    if (!DEMO) {
      setNotice('In-app purchase coming with the TestFlight build.');
      return;
    }
    setStarting(true);
    setNotice(null);
    try {
      const until = new Date();
      until.setMonth(until.getMonth() + (plan === 'quarterly' ? 3 : 1));
      await updateProfile({ is_plus: true, plus_until: until.toISOString() });
    } catch {
      setNotice(copy.errors.didNotSave);
    } finally {
      setStarting(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Stack gap={spacing.xl}>
        <Stack gap={spacing.sm}>
          <Heading>{copy.plus.pitch}</Heading>
          <Body color={colors.textSecondary}>{copy.plus.what}</Body>
        </Stack>

        {profile.is_plus ? (
          <Card tone="highlight">
            <Heading>You’re on Mash Plus.</Heading>
            {profile.plus_until ? <Caption>Until {formatDate(profile.plus_until)}.</Caption> : null}
          </Card>
        ) : (
          <Stack gap={spacing.md}>
            {trialLine ? <Body>{trialLine}</Body> : null}
            <PlanCard
              title={PRICING.monthly.label}
              price={`${PRICING.monthly.price} ${PRICING.monthly.per}`}
              selected={plan === 'monthly'}
              onPress={() => setPlan('monthly')}
            />
            <PlanCard
              title={PRICING.quarterly.label}
              price={`${PRICING.quarterly.price} ${PRICING.quarterly.per}`}
              note={PRICING.quarterly.saving}
              selected={plan === 'quarterly'}
              onPress={() => setPlan('quarterly')}
            />
            <Button
              title="Start Mash Plus"
              variant="accent"
              onPress={start}
              loading={starting}
              accessibilityLabel="Start Mash Plus"
            />
            {notice ? <Caption center>{notice}</Caption> : null}
          </Stack>
        )}

        <Caption center>{FOOTNOTE}</Caption>
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
      accessibilityLabel={`${title}, ${price}`}
      accessibilityState={{ selected }}
    >
      <Stack row align="center" justify="space-between">
        <Stack gap={2}>
          <Heading>{title}</Heading>
          <Body color={colors.textSecondary}>{price}</Body>
          {note ? <Caption>{note}</Caption> : null}
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
