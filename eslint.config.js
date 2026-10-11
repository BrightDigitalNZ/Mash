// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/functions/**', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      'import/no-unresolved': 'off',
    },
  },
]);
