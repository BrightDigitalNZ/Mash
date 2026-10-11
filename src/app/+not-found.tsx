import { router } from 'expo-router';

import { Button, Empty, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Empty title="That page is not here" body="It may have moved, or the link is old." />
      <Button title="Go home" variant="secondary" onPress={() => router.replace('/')} />
    </Screen>
  );
}
