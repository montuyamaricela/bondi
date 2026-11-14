import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import { assertTestDatabase } from './tests/helpers/test-database';

try {
  if (!assertTestDatabase().native) throw new Error();
} catch {
  throw new Error(
    'Native Supabase tests require the explicit prepared .env.supabase.test.local environment.',
  );
}

export default defineConfig({
  ...base,
  testDir: './tests/supabase',
  globalSetup: './tests/helpers/supabase-setup.ts',
});
