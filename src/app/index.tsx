import { Redirect } from 'expo-router';
import { useState } from 'react';

import { ErrorView, Loading, Screen } from '@/components/ui';
import { homeFor, useSession } from '@/store/session';

/** The front door. Sends people where their state says they should be. */
export default function Index() {
  const booting = useSession((s) => s.booting);
  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const [retrying, setRetrying] = useState(false);

  if (booting) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  // Signed in but no profile: the first load failed (offline, or the row is not there yet).
  // Give a way to try again rather than a spinner with no exit, and never bounce to welcome.
  if (!profile) {
    if (retrying) return <Loading />;
    return (
      <Screen>
        <ErrorView
          message="Your profile did not load. Check your connection and try again."
          onRetry={async () => {
            setRetrying(true);
            try {
              await refreshProfile();
            } finally {
              setRetrying(false);
            }
          }}
        />
      </Screen>
    );
  }
  return <Redirect href={homeFor(profile) as never} />;
}
