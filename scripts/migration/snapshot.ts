import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import {
  applicationTables,
  artifactRoot,
  digest,
  fail,
  MigrationError,
  pgEnvironment,
  pgTool,
  quoted,
  tables,
  verifyMarker,
  type MigrationConfiguration,
} from './environment';

export type TableSnapshot = Record<string, { count: string; sha256: string }>;
export type MigrationLedgerRow = {
  id: string;
  checksum: string;
  finished_at: Date | null;
  migration_name: string;
  logs: string | null;
  rolled_back_at: Date | null;
  started_at: Date;
  applied_steps_count: number;
};
export async function ledger(db: PrismaClient) {
  const rows = await db.$queryRaw<
    MigrationLedgerRow[]
  >`SELECT * FROM public._prisma_migrations ORDER BY migration_name`;
  const names = readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (
    JSON.stringify(rows.map((row) => row.migration_name)) !== JSON.stringify(names) ||
    rows.some(
      (row) =>
        !row.finished_at ||
        row.rolled_back_at ||
        row.checksum !==
          digest(readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`, 'utf8')),
    )
  )
    fail('Migration ledger is incomplete or differs from the immutable committed checksums.');
  return rows;
}
export async function schemaSignature(db: PrismaClient) {
  await applicationTables(db);
  const columns = await db.$queryRaw`SELECT table_name, column_name, ordinal_position,
    data_type, udt_schema, udt_name, is_nullable, column_default,
    character_maximum_length, numeric_precision, numeric_scale, datetime_precision
    FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position`;
  const constraints = await db.$queryRaw`SELECT t.relname AS table_name, c.conname AS name,
    pg_get_constraintdef(c.oid, false) AS definition
    FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public' ORDER BY t.relname, c.conname`;
  const indexes =
    await db.$queryRaw`SELECT tablename, indexname, indexdef FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public' ORDER BY tablename, indexname`;
  return digest(JSON.stringify({ columns, constraints, indexes }));
}
export async function emptyApplication(db: PrismaClient) {
  await applicationTables(db);
  for (const table of tables) {
    if (table === '_prisma_migrations') continue;
    const [row] = await db.$queryRawUnsafe<Array<{ count: string }>>(
      `SELECT count(*)::text AS count FROM ${quoted(table)}`,
    );
    if (row.count !== '0')
      fail('Transfer destination is populated; no existing application rows may be overwritten.');
  }
}
export async function nativeBoundaries(db: PrismaClient) {
  const permissions = await db.$queryRaw<Array<{ name: string; rls: boolean; exposed: boolean }>>`
    SELECT c.relname::text AS name, c.relrowsecurity AS rls,
      (has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
       OR has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) AS exposed
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'`;
  if (permissions.length !== tables.length || permissions.some((row) => !row.rls || row.exposed))
    fail('Target application RLS/grants do not preserve private server ownership.');
  const [native] = await db.$queryRaw<
    Array<{ dispatcher: string | null; guard: string | null; policy: boolean; jobs: number }>
  >`
    SELECT to_regprocedure('bondi_private.dispatch_message_hints(text)')::text AS dispatcher,
      to_regprocedure('bondi_private.can_receive_realtime(text)')::text AS guard,
      EXISTS (SELECT 1 FROM pg_catalog.pg_policies WHERE schemaname = 'realtime'
        AND tablename = 'messages' AND policyname = 'bondi_session_receive') AS policy,
      (SELECT count(*)::int FROM cron.job WHERE jobname IN ('bondi-message-delivery', 'bondi-typing-retention')) AS jobs`;
  if (!native.dispatcher || !native.guard || !native.policy || native.jobs !== 2)
    fail(
      'Native authorization, private policy or managed delivery/retention bootstrap is missing.',
    );
}
function streamDigest(url: string, sql: string) {
  const command = pgTool('psql');
  return new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256');
    const child = spawn(
      command,
      ['-X', '--no-password', '--quiet', '--set', 'ON_ERROR_STOP=1', '--command', sql],
      { env: pgEnvironment(url), stdio: ['ignore', 'pipe', 'pipe'], timeout: 600_000 },
    );
    child.stdout.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    child.stderr.resume();
    child.once('error', () =>
      reject(new MigrationError('Fingerprint client failed; private diagnostics are omitted.')),
    );
    child.once('close', (code) =>
      code === 0
        ? resolveHash(hash.digest('hex'))
        : reject(new MigrationError('Fingerprint query failed; private diagnostics are omitted.')),
    );
  });
}
export async function snapshot(db: PrismaClient, url: string): Promise<TableSnapshot> {
  await applicationTables(db);
  const result: TableSnapshot = {};
  for (const table of tables) {
    const [row] = await db.$queryRawUnsafe<Array<{ count: string; keys: string[] }>>(`SELECT
      (SELECT count(*)::text FROM ${quoted(table)}) AS count,
      (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
       FROM pg_catalog.pg_index i CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY k(attnum, ordinality)
       JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
       WHERE i.indrelid = '${quoted(table)}'::regclass AND i.indisprimary) AS keys`);
    if (!row.keys?.length || row.keys.some((key) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)))
      fail('Stable reviewed primary keys are required for migration fingerprints.');
    const ordering = row.keys.map((key) => `t."${key}"`).join(', ');
    result[table] = {
      count: row.count,
      sha256: await streamDigest(
        url,
        `COPY (SELECT row_to_json(t)::text FROM ${quoted(table)} t ORDER BY ${ordering}) TO STDOUT`,
      ),
    };
  }
  return result;
}
export function sameSnapshot(left: TableSnapshot, right: TableSnapshot) {
  return tables.every((table) => {
    const source = left[table];
    const target = right[table];
    return !!source && !!target && source.count === target.count && source.sha256 === target.sha256;
  });
}
export async function preflight(
  local: MigrationConfiguration,
  source: PrismaClient,
  target: PrismaClient,
) {
  const sourceIdentity = await verifyMarker(source, local, 'source');
  const targetIdentity = await verifyMarker(target, local, 'target');
  await ledger(source);
  await ledger(target);
  await emptyApplication(target);
  await nativeBoundaries(target);
  const sourceSchema = await schemaSignature(source);
  if (sourceSchema !== (await schemaSignature(target)))
    fail('Source and target application schemas differ.');
  pgTool('pg_dump');
  pgTool('psql');
  return { source: sourceIdentity, target: targetIdentity, schema: sourceSchema };
}
export function exportData(url: string, file = resolve(artifactRoot, 'source-data.sql')) {
  const output = openSync(file, 'wx', 0o600);
  try {
    const result = spawnSync(
      pgTool('pg_dump'),
      [
        '--no-password',
        '--data-only',
        '--no-owner',
        '--no-acl',
        '--quote-all-identifiers',
        '--strict-names',
        ...tables.flatMap((table) => ['--table', quoted(table)]),
      ],
      {
        env: pgEnvironment(url),
        stdio: ['ignore', output, 'pipe'],
        encoding: 'utf8',
        timeout: 600_000,
      },
    );
    if (result.error || result.status !== 0)
      fail('Source backup failed; partial private artifact remains unverified.');
  } finally {
    closeSync(output);
  }
  return file;
}
