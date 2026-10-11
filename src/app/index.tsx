import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { homeFor, useSession } from '@/store/session';

/** The front door. Sends people where their state says they should be. */
export default function Index() {
  const booting = useSession((s) => s.booting);
  const session = useSession((s) => s.session);
  const profile = useSession((s) => s.profile);

  if (booting) return <Loading />;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  // Signed in but the profile has not loaded yet: wait, do not bounce to welcome.
  if (!profile) return <Loading />;
  return <Redirect href={homeFor(profile) as never} />;
}
