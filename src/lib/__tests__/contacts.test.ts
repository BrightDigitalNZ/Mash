import { allHashes, hashPhone, normalisePhone } from '@/lib/contacts';

describe('normalisePhone', () => {
  it('turns an NZ mobile with a trunk zero into E.164 digits', () => {
    expect(normalisePhone('021 123 4567', 'NZ')).toBe('64211234567');
  });

  it('keeps an international number with a plus', () => {
    expect(normalisePhone('+61 412 345 678', 'NZ')).toBe('61412345678');
  });

  it('treats a 00 prefix as international', () => {
    expect(normalisePhone('0061412345678', 'NZ')).toBe('61412345678');
  });

  it('assumes the default country for a bare local number', () => {
    expect(normalisePhone('412345678', 'AU')).toBe('61412345678');
  });

  it('strips punctuation', () => {
    expect(normalisePhone('(09) 555-1234', 'NZ')).toBe('6495551234');
  });

  it('rejects junk', () => {
    expect(normalisePhone('', 'NZ')).toBeNull();
    expect(normalisePhone('12', 'NZ')).toBeNull();
    expect(normalisePhone('+1234567890123456789', 'NZ')).toBeNull();
  });
});

describe('hashPhone', () => {
  it('is deterministic and never contains the number', async () => {
    const a = await hashPhone('64211234567');
    const b = await hashPhone('64211234567');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).not.toContain('64211234567');
  });

  it('differs for different numbers', async () => {
    expect(await hashPhone('64211234567')).not.toBe(await hashPhone('64211234568'));
  });
});

describe('allHashes', () => {
  it('dedupes across contacts', () => {
    const out = allHashes([
      { id: '1', name: 'A', hashes: ['x', 'y'], image: null },
      { id: '2', name: 'B', hashes: ['y', 'z'], image: null },
    ]);
    expect(out.sort()).toEqual(['x', 'y', 'z']);
  });
});
