import { randomBytes } from 'node:crypto';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { assertTestDatabase } from '../tests/helpers/test-database';

const project = 'bondi-integration';
class PreparationError extends Error {}

async function main() {
  if (
    process.argv.slice(2).join(' ') !== `--confirm-project ${project}` ||
    !/^project_id\s*=\s*"bondi-integration"\s*$/m.test(readFileSync('supabase/config.toml', 'utf8'))
  )
    throw new PreparationError(
      'Confirm the owned local project with --confirm-project bondi-integration.',
    );
  const result = spawnSync('npx', ['--no-install', 'supabase', 'status', '--output', 'json'], {
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0)
    throw new PreparationError(
      'The owned local Supabase stack is unavailable. Run npm run supabase:start first.',
    );
  const status: Record<string, unknown> = JSON.parse(result.stdout);
  const database = status.DB_URL;
  const api = status.API_URL;
  const publicKey = status.PUBLISHABLE_KEY || status.ANON_KEY;
  const secretKey = status.SECRET_KEY || status.SERVICE_ROLE_KEY;
  if (
    [database, api, publicKey, secretKey].some(
      (value) => typeof value !== 'string' || !value.trim(),
    )
  )
    throw new PreparationError(
      'Supabase status is missing required local API/database credentials.',
    );
  if (typeof database !== 'string' || typeof api !== 'string')
    throw new PreparationError('Supabase status has invalid endpoint values.');
  const values: Record<string, string> = {
    DATABASE_URL: database,
    DIRECT_URL: database,
    BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    BETTER_AUTH_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_SOCKET_URL: 'http://127.0.0.1:3100',
    UPLOADTHING_TOKEN: '',
    NEXT_TELEMETRY_DISABLED: '1',
    BONDI_TEST_PROJECT: project,
    BONDI_TEST_CONFIRM: `${project}/postgres`,
    BONDI_TEST_MARKER: randomBytes(32).toString('hex'),
    SUPABASE_TEST_URL: api,
    SUPABASE_TEST_PUBLIC_KEY: String(publicKey),
    SUPABASE_TEST_SECRET_KEY: String(secretKey),
    NEXT_PUBLIC_SUPABASE_REALTIME: 'true',
    NEXT_PUBLIC_SUPABASE_URL: api,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: String(publicKey),
    SUPABASE_SECRET_KEY: String(secretKey),
    SUPABASE_SIGNING_KEYS_PATH: 'supabase/signing_keys.json',
  };
  assertTestDatabase(values);
  const db = new PrismaClient({ datasources: { db: { url: database } }, log: [] });
  try {
    const identity = await db.$queryRaw<
      Array<{ name: string; version: number; realtime: string | null }>
    >`
      SELECT current_database() AS name, current_setting('server_version_num')::int AS version,
        to_regclass('realtime.messages')::text AS realtime`;
    if (
      identity.length !== 1 ||
      identity[0].name !== 'postgres' ||
      identity[0].version < 170000 ||
      !identity[0].realtime
    )
      throw new PreparationError(
        'The local target is not the expected native Supabase PostgreSQL stack.',
      );
    await db.$executeRawUnsafe('CREATE SCHEMA IF NOT EXISTS bondi_test');
    await db.$executeRawUnsafe('REVOKE ALL ON SCHEMA bondi_test FROM PUBLIC, anon, authenticated');
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS bondi_test.environment (
      singleton BOOLEAN PRIMARY KEY CHECK (singleton), project TEXT NOT NULL, nonce TEXT NOT NULL
    )`);
    await db.$executeRawUnsafe(
      'REVOKE ALL ON TABLE bondi_test.environment FROM PUBLIC, anon, authenticated',
    );
    await db.$executeRaw`INSERT INTO bondi_test.environment(singleton, project, nonce)
      VALUES (true, ${project}, ${values.BONDI_TEST_MARKER})
      ON CONFLICT (singleton) DO UPDATE SET project = excluded.project, nonce = excluded.nonce`;
  } finally {
    await db.$disconnect();
  }
  // This file is ignored; status JSON, passwords and keys never reach console output.
  writeFileSync(
    '.env.supabase.test.local',
    Object.entries(values)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n') + '\n',
    { mode: 0o600 },
  );
  chmodSync('.env.supabase.test.local', 0o600);
  if (process.env.GITHUB_ENV) {
    const lines: string[] = [];
    for (const [key, value] of Object.entries(values)) {
      if (/[\r\n]/.test(value)) throw new Error('Test environment values must be single-line.');
      if (
        key.endsWith('_KEY') ||
        key.endsWith('_SECRET') ||
        key.endsWith('_URL') ||
        key.endsWith('_MARKER')
      )
        process.stdout.write(`::add-mask::${value}\n`);
      lines.push(`${key}=${value}`);
    }
    writeFileSync(process.env.GITHUB_ENV, lines.join('\n') + '\n', { flag: 'a' });
  }
  console.log(
    'Prepared owned local Supabase test configuration and database marker. Apply Prisma migrations explicitly next.',
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof PreparationError
      ? error.message
      : 'Supabase test preparation failed. Check the explicit project confirmation and local stack; no credential details are logged.',
  );
  process.exitCode = 1;
});
