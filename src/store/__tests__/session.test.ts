import { homeFor } from '@/store/session';
import type { Profile } from '@/types/database';

const base: Profile = {
  id: 'u1',
  role: null,
  first_name: 'Tin',
  last_name: '',
  photo_url: null,
  date_of_birth: null,
  city: null,
  country: null,
  bio: null,
  phone_hash: null,
  is_plus: false,
  plus_until: null,
  paused: false,
  onboarding_complete: false,
  gender: null,
  seeking: [],
  open_to_matching: false,
  trial_started_at: null,
  trial_ends_at: null,
  verified_identity: false,
  photos_current: false,
  verified_at: null,
  dd_consent: false,
  mashmaker_visibility: 'minimal',
  catch_rules_accepted_at: null,
  mashmaker_rules_accepted_at: null,
  created_at: '',
  updated_at: '',
};

describe('homeFor', () => {
  it('sends a signed-out user to welcome', () => {
    expect(homeFor(null)).toBe('/(auth)/welcome');
  });

  it('asks for the basics first', () => {
    expect(homeFor(base)).toBe('/(onboarding)/about');
  });

  it('then the role', () => {
    expect(homeFor({ ...base, date_of_birth: '1988-01-01', city: 'Auckland' })).toBe(
      '/(onboarding)/role',
    );
  });

  it('catches go to criteria until they switch matching on, mashmakers to contacts', () => {
    const basics = { ...base, date_of_birth: '1988-01-01', city: 'Auckland' };
    expect(homeFor({ ...basics, role: 'catch' })).toBe('/(onboarding)/criteria');
    expect(homeFor({ ...basics, role: 'catch', open_to_matching: true })).toBe(
      '/(onboarding)/contacts',
    );
    expect(homeFor({ ...basics, role: 'mashmaker' })).toBe('/(onboarding)/contacts');
  });

  it('finished users land on their home tab', () => {
    const done = { ...base, onboarding_complete: true };
    expect(homeFor({ ...done, role: 'catch' })).toBe('/(catch)/mashmakers');
    expect(homeFor({ ...done, role: 'mashmaker' })).toBe('/(mashmaker)/catches');
  });
});
