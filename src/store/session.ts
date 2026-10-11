// Who is signed in and what their profile looks like. One store, read everywhere.

import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { identify, resetAnalytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  /** true until the first auth check and profile load have finished */
  booting: boolean;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (patch: Partial<Profile>) => Promise<Profile>;
}

export const useSession = create<SessionState>((set, get) => ({
  session: null,
  profile: null,
  booting: true,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) {
      set({ profile: null });
      return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.warn('profile load failed', error.message);
      return get().profile;
    }
    const profile = data as Profile;
    set({ profile });
    identify(userId, { role: profile.role, city: profile.city, is_plus: profile.is_plus });
    return profile;
  },

  updateProfile: async (patch) => {
    const userId = get().session?.user.id;
    if (!userId) throw new Error('Not signed in');
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw error;
    const profile = data as Profile;
    set({ profile });
    return profile;
  },
}));

/** Call once from the root layout. Keeps the store in step with Supabase auth. */
export function bootSession(): () => void {
  const store = useSession.getState();

  supabase.auth
    .getSession()
    .then(async ({ data }) => {
      store.setSession(data.session);
      await useSession.getState().refreshProfile();
    })
    .finally(() => useSession.setState({ booting: false }));

  const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
    useSession.getState().setSession(session);
    if (session) {
      await useSession.getState().refreshProfile();
    } else {
      useSession.getState().setProfile(null);
      resetAnalytics();
    }
  });

  return () => sub.subscription.unsubscribe();
}

/** Where a signed-in user should land, given their profile. */
export function homeFor(profile: Profile | null): string {
  if (!profile) return '/(auth)/welcome';
  if (!profile.onboarding_complete) {
    if (!profile.date_of_birth || !profile.city) return '/(onboarding)/about';
    if (!profile.role) return '/(onboarding)/role';
    return profile.role === 'single' ? '/(onboarding)/criteria' : '/(onboarding)/contacts';
  }
  return profile.role === 'voucher' ? '/(voucher)/friends' : '/(single)/circle';
}
