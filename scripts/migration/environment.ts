import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export const project = 'bondi-migration-rehearsal';
export const sourceContainer = 'bondi-migration-source';
export const sourceImage = 'postgres:14.25-bookworm';
export const workdir = resolve('tooling/migration-rehearsal');
export const artifactRoot = resolve('.agent-runs/migration-rehearsal');
export const configurationFile = resolve(artifactRoot, 'local.json');
export const tables = [
  'Account',
  'File',
  'Like',
  'LocationCatalog',
  'LocationCity',
  'LocationCityName',
  'Match',
  'Message',
  'MessageAttachment',
  'MessageDelivery',
  'Notification',
  'Profile',
  'RealtimeLease',
  'Session',
  'TypingLease',
  'User',
  'Verification',
  '_prisma_migrations',
] as const;
export class MigrationError extends Error {}
export function fail(message: string): never {
  throw new MigrationError(message);
}

export function publicApiKey(key: string) {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const parts = key.split('.');
    return (
      parts.length === 3 &&
      JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).role === 'anon'
    );
  } catch {
    return false;
  }
}

const configurationSchema = z.object({
  project: z.literal(project),
  runId: z.uuid(),
  nonce: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: z.string(),
  targetUrl: z.string(),
  apiUrl: z.literal('http://127.0.0.1:54331'),
  publicKey: z.string().min(1).refine(publicApiKey),
  secretKey: z.string().min(1),
  authSecret: z.string().min(32),
  createdAt: z.iso.datetime(),
});
export type MigrationConfiguration = z.infer<typeof configurationSchema>;

export function privateDirectory(path: string) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || info.mode & 0o077)
    fail('Migration artifacts require a private owned directory.');
  if (process.getuid && info.uid !== process.getuid()) fail('Migration directory owner mismatch.');
}
export function readPrivateJson(path: string): unknown {
  try {
    const info = lstatSync(path);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.mode & 0o077 ||
      (process.getuid && info.uid !== process.getuid())
    )
      throw new Error();
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fail('Migration configuration/artifact must be an owned private JSON file.');
  }
}
export function writePrivateJson(path: string, value: unknown, exclusive = true) {
  if (!exclusive) readPrivateJson(path);
  const destination = exclusive ? path : `${path}.${randomUUID()}.tmp`;
  writeFileSync(destination, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  chmodSync(destination, 0o600);
  if (!exclusive) renameSync(destination, path);
}

export function databaseIdentity(value: string) {
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== '127.0.0.1' ||
      !url.username ||
      !url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)),
    };
  } catch {
    return fail('Rehearsal URLs must identify explicit direct loopback PostgreSQL connections.');
  }
}
export function validateConfiguration(input: unknown): MigrationConfiguration {
  const parsed = configurationSchema.safeParse(input);
  if (!parsed.success)
    return fail('Migration configuration is incomplete or has an unapproved project/API target.');
  const configuration = parsed.data;
  const source = databaseIdentity(configuration.sourceUrl);
  const target = databaseIdentity(configuration.targetUrl);
  if (
    source.port !== 54329 ||
    source.database !== 'bondi_migration_source_test' ||
    target.port !== 54332 ||
    target.database !== 'postgres' ||
    JSON.stringify(source) === JSON.stringify(target)
  )
    return fail(
      'Rehearsal source/target identities do not match the isolated disposable databases.',
    );
  return configuration;
}
export function configuration() {
  return validateConfiguration(readPrivateJson(configurationFile));
}
export function confirmProject(args: string[]) {
  if (args.join(' ') !== `--confirm-project ${project}`)
    fail(`Explicit confirmation required: --confirm-project ${project}`);
}

export function captured(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv; input?: string; timeout?: number } = {},
) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    timeout: options.timeout ?? 120_000,
    ...options,
  });
  if (result.error || result.status !== 0)
    fail('Migration subprocess failed; private command output is omitted.');
  return result.stdout;
}
export function pgEnvironment(value: string) {
  const identity = databaseIdentity(value);
  const url = new URL(value);
  const environment: NodeJS.ProcessEnv = { ...process.env };
  for (const name of Object.keys(environment)) if (name.startsWith('PG')) delete environment[name];
  return {
    ...environment,
    PGHOST: identity.host,
    PGPORT: String(identity.port),
    PGDATABASE: identity.database,
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: '-c timezone=UTC -c DateStyle=ISO -c extra_float_digits=3',
    PGAPPNAME: 'bondi-migration-operator',
    PSQL_HISTORY: '/dev/null',
  };
}
export function pgTool(name: 'pg_dump' | 'psql') {
  const command = process.env.BONDI_PG_BIN ? resolve(process.env.BONDI_PG_BIN, name) : name;
  const version = captured(command, ['--version']);
  if (!/\(PostgreSQL\) 17\./.test(version))
    fail('Migration requires PostgreSQL 17 pg_dump and psql client tools.');
  return command;
}
export function psql(value: string, sql: string) {
  return captured(
    pgTool('psql'),
    [
      '-X',
      '--no-password',
      '--quiet',
      '--tuples-only',
      '--no-align',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      sql,
    ],
    { env: pgEnvironment(value) },
  );
}
export function client(url: string) {
  databaseIdentity(url);
  return new PrismaClient({ log: [], datasources: { db: { url } } });
}
export const quoted = (name: string) => {
  if (!tables.some((table) => table === name)) fail('Unexpected application table.');
  return `public."${name}"`;
};
export async function verifyMarker(
  db: PrismaClient,
  expected: MigrationConfiguration,
  role: 'source' | 'target',
) {
  try {
    const rows = await db.$queryRaw<
      Array<{
        project: string;
        runId: string;
        nonce: string;
        role: string;
        apiUrl: string;
        database: string;
        version: number;
      }>
    >`
      SELECT project, "runId", nonce, role, "apiUrl", current_database() AS database,
        current_setting('server_version_num')::int AS version FROM bondi_rehearsal.environment WHERE singleton = true`;
    const row = rows[0];
    if (
      rows.length !== 1 ||
      row.project !== project ||
      row.runId !== expected.runId ||
      row.nonce !== expected.nonce ||
      row.role !== role ||
      row.apiUrl !== expected.apiUrl ||
      row.database !== (role === 'source' ? 'bondi_migration_source_test' : 'postgres') ||
      (role === 'source'
        ? row.version < 140000 || row.version >= 150000
        : row.version < 170000 || row.version >= 180000)
    )
      throw new Error();
    if (role === 'target') {
      const [native] = await db.$queryRaw<
        Array<{ realtime: string | null }>
      >`SELECT to_regclass('realtime.messages')::text AS realtime`;
      if (!native.realtime) throw new Error();
    }
    return { database: row.database, version: row.version };
  } catch {
    return fail(
      'The actual database/project/marker/version does not match the confirmed rehearsal.',
    );
  }
}
export async function applicationTables(db: PrismaClient) {
  const rows = await db.$queryRaw<Array<{ name: string }>>`
    SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  if (JSON.stringify(rows.map(({ name }) => name)) !== JSON.stringify(tables))
    fail('Application tables differ from the reviewed migration allowlist.');
  return rows.map(({ name }) => name);
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
