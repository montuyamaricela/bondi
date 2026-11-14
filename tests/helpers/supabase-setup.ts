import verifyTestDatabase from './database-setup';
import { assertTestDatabase } from './test-database';

export default async function verifyNativeSupabase() {
  if (!assertTestDatabase().native)
    throw new Error(
      'Native Supabase tests require the explicitly prepared Supabase test environment.',
    );
  if (!process.env.SUPABASE_TEST_PUBLIC_KEY || !process.env.SUPABASE_TEST_SECRET_KEY)
    throw new Error(
      'Native Supabase test API credentials are missing. Run the explicit test preparation.',
    );
  await verifyTestDatabase();
}
