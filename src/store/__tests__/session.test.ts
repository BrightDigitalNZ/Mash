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
  verified_photo: false,
  verified_social: false,
  brief_consent: false,
  reverse_image_consent: false,
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
    expect(homeFor({ ...base, date_of_birth: '1988-01-01', city: 'Auckland' })).toBe('/(onboarding)/role');
  });

  it('singles go to criteria, vouchers to contacts', () => {
    const basics = { ...base, date_of_birth: '1988-01-01', city: 'Auckland' };
    expect(homeFor({ ...basics, role: 'single' })).toBe('/(onboarding)/criteria');
    expect(homeFor({ ...basics, role: 'voucher' })).toBe('/(onboarding)/contacts');
  });

  it('finished users land on their home tab', () => {
    const done = { ...base, onboarding_complete: true };
    expect(homeFor({ ...done, role: 'single' })).toBe('/(single)/circle');
    expect(homeFor({ ...done, role: 'voucher' })).toBe('/(voucher)/friends');
  });
});
