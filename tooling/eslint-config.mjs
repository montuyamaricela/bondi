import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/out/**',
    '**/build/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.tsbuildinfo',
    '**/next-env.d.ts',
    '.agents/**',
    '.claude/skills/**',
    'third-party/**',
    '.agent-runs/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  js.configs.recommended,
  ...nextVitals,
  ...nextTypescript,
  { rules: jsxA11y.configs.recommended.rules },
  {
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'default-param-last': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['res'] }],
      'no-promise-executor-return': 'error',
      'no-return-assign': ['error', 'always'],
      'no-unmodified-loop-condition': 'error',
      'no-useless-assignment': 'error',
      'prefer-promise-reject-errors': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
          message: 'Keep environment reads in the existing environment owners or an env module.',
        },
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: 'Keep environment reads in the existing environment owners or an env module.',
        },
      ],
    },
  },
  {
    files: ['**/*.config.{ts,js,mjs}', 'tooling/**'],
    rules: { 'no-param-reassign': 'off', 'no-restricted-syntax': 'off' },
  },
  {
    // Runtime reads belong to the validated env modules; upload credentials remain an owned seam.
    files: ['**/env.{ts,js,mjs}', 'app/api/profile/photos/**/route.ts', 'scripts/**', 'tests/**'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
]);
