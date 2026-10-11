// Contacts never leave the device as names or numbers.
// Each phone number is normalised to E.164 and hashed with SHA-256 before upload.
// The server only ever sees hashes, and matches them against other users' hashes.

import { Contact, ContactField, requestPermissionsAsync, getPermissionsAsync } from 'expo-contacts';
import * as Crypto from 'expo-crypto';

import type { CountryCode } from '@/types/database';

const COUNTRY_DIAL: Record<CountryCode, string> = { NZ: '64', AU: '61' };

/**
 * Normalise a phone number to E.164 without the leading plus, e.g. "6421123456".
 * Returns null when the input cannot be a mobile or landline number.
 */
export function normalisePhone(raw: string, defaultCountry: CountryCode = 'NZ'): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    digits = COUNTRY_DIAL[defaultCountry] + digits.slice(1);
  } else if (digits.length >= 8 && digits.length <= 10) {
    // No trunk prefix and no country code: assume local.
    digits = COUNTRY_DIAL[defaultCountry] + digits;
  }
  if (digits.length < 9 || digits.length > 15) return null;
  return digits;
}

/** SHA-256 hex of the normalised number. Same function server-side and on every device. */
export async function hashPhone(normalised: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `mash:${normalised}`, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export interface LocalContact {
  id: string;
  name: string;
  /** hashes of every usable number on this contact */
  hashes: string[];
  image: string | null;
}

export async function ensureContactsPermission(): Promise<boolean> {
  const current = await getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await requestPermissionsAsync();
  return asked.granted;
}

/**
 * Read the address book and return each contact with hashed numbers.
 * Names and images stay in memory on the device for the nominate screen only.
 */
export async function readHashedContacts(country: CountryCode = 'NZ'): Promise<LocalContact[]> {
  const details = await Contact.getAllDetails([
    ContactField.GIVEN_NAME,
    ContactField.FAMILY_NAME,
    ContactField.PHONES,
    ContactField.THUMBNAIL,
  ]);

  const out: LocalContact[] = [];
  for (const c of details) {
    const numbers = (c.phones ?? [])
      .map((p) => (p.number ? normalisePhone(p.number, country) : null))
      .filter((n): n is string => n !== null);
    if (numbers.length === 0) continue;
    const unique = Array.from(new Set(numbers));
    const hashes = await Promise.all(unique.map(hashPhone));
    const name = [c.givenName, c.familyName].filter(Boolean).join(' ').trim();
    if (!name) continue;
    out.push({ id: c.id, name, hashes, image: c.thumbnail ?? null });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/** Flatten to the unique set of hashes for upload. */
export function allHashes(contacts: LocalContact[]): string[] {
  const set = new Set<string>();
  for (const c of contacts) for (const h of c.hashes) set.add(h);
  return Array.from(set);
}
