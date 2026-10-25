// ESLint 9 flat config: typescript-eslint recommended (no type-aware rules),
// with eslint-config-prettier last so formatting is left to Prettier.
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'drizzle/**'],
  },
  ...tsPlugin.configs['flat/recommended'],
  {
    rules: {
      // Pre-existing violations, downgraded so lint can block CI without a
      // rewrite. Fix them over time, then set these back to "error".
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  prettierConfig,
];
