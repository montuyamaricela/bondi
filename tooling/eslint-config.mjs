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
      'no-param-reassign': [
        'error',
        { props: true, ignorePropertyModificationsFor: ['socket', 'res'] },
      ],
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
    // Existing owners stay explicit until validated server/client env modules replace them.
    files: [
      '**/env.{ts,js,mjs}',
      'server.ts',
      'socket-server.ts',
      'lib/auth.ts',
      'lib/auth-client.ts',
      'lib/db.ts',
      'lib/socket.ts',
      'app/api/profile/photos/**/route.ts',
      'app/components/providers/socket-provider.tsx',
      'scripts/**',
      'tests/**',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  prettier,
]);
