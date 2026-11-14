import { PrismaClient } from '@prisma/client';
import { assertNativeMarker, assertTestDatabase } from './test-database';

export async function verifyDatabaseSafety(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const target = assertTestDatabase(environment);
  if (!target.native) return;
  const db = new PrismaClient({ datasources: { db: { url: target.url } }, log: [] });
  try {
    const rows = await db.$queryRaw<Array<{ project: string; nonce: string; database: string }>>`
      SELECT project, nonce, current_database() AS database
      FROM bondi_test.environment WHERE singleton = true`;
    assertNativeMarker(target, rows.length === 1 ? rows[0] : undefined);
  } catch {
    throw new Error(
      'Native test safety verification failed. Run the explicit Supabase test preparation.',
    );
  } finally {
    await db.$disconnect();
  }
}

export default function verifyTestDatabase() {
  return verifyDatabaseSafety(process.env);
}
