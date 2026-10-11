// Jest setup. Native modules that need a device are mocked here.

jest.mock('expo-crypto', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto') as {
    createHash: (alg: string) => { update: (d: string) => { digest: (enc: 'hex') => string } };
    randomUUID: () => string;
  };
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex', BASE64: 'base64' },
    digestStringAsync: async (_alg: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data).digest('hex'),
    randomUUID: () => nodeCrypto.randomUUID(),
  };
});

jest.mock('expo-contacts', () => ({
  Contact: { getAllDetails: jest.fn(async () => []) },
  ContactField: { GIVEN_NAME: 'givenName', FAMILY_NAME: 'familyName', PHONES: 'phones', THUMBNAIL: 'thumbnail' },
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
