import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { transferState } from './scripts/migration/transfer';
const state = transferState();
if (
  state.phase !== 'accepted' ||
  !state.failureProven ||
  !state.targetHttpProven ||
  !state.rollbackHttpProven ||
  !state.deliveryProven
)
  throw new Error(
    'Migration browser qualification requires the explicitly completed isolated transfer/rollback/native recovery.',
  );
export default defineConfig({
  ...base,
  testDir: './tests/migration',
  globalSetup: './tests/helpers/migration-setup.ts',
});
