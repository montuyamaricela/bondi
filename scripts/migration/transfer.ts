import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import {
  artifactRoot,
  captured,
  client,
  configuration,
  databaseIdentity,
  fail,
  pgEnvironment,
  pgTool,
  psql,
  quoted,
  readPrivateJson,
  tables,
  verifyMarker,
  writePrivateJson,
} from './environment';
import {
  emptyApplication,
  exportData,
  ledger,
  nativeBoundaries,
  preflight,
  sameSnapshot,
  schemaSignature,
  snapshot,
  type TableSnapshot,
} from './snapshot';
import { sessions } from './runtime';

export const stateFile = resolve(artifactRoot, 'transfer.json');
const dumpFile = resolve(artifactRoot, 'source-data.sql');
const snapshots = z
  .record(
    z.string(),
    z.object({ count: z.string().regex(/^\d+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  )
  .refine(
    (value) =>
      Object.keys(value).length === tables.length &&
      tables.every((table) => value[table] !== undefined),
  );
const stateSchema = z
  .object({
    runId: z.uuid(),
    phase: z.enum(['capturing', 'captured', 'verified', 'rolled-back', 'accepting', 'accepted']),
    source: snapshots.optional(),
    targetBefore: snapshots.optional(),
    dumpHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    schema: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    failureProven: z.boolean().default(false),
    targetHttpProven: z.boolean().default(false),
    rollbackHttpProven: z.boolean().default(false),
    deliveryProven: z.boolean().default(false),
    createdAt: z.iso.datetime(),
  })
  .refine(
    (state) =>
      ['capturing', 'rolled-back'].includes(state.phase) ||
      !!(state.source && state.targetBefore && state.dumpHash && state.schema),
  )
  .refine(
    (state) => !['verified', 'accepting', 'accepted'].includes(state.phase) || state.failureProven,
  )
  .refine(
    (state) =>
      !['accepting', 'accepted'].includes(state.phase) ||
      (state.targetHttpProven && state.rollbackHttpProven),
  );
export type TransferState = z.infer<typeof stateSchema>;
export function validateTransferState(input: unknown, runId: string) {
  const parsed = stateSchema.safeParse(input);
  if (!parsed.success || parsed.data.runId !== runId)
    fail('Transfer state does not belong to this confirmed rehearsal.');
  return parsed.data;
}
export function transferState() {
  return validateTransferState(readPrivateJson(stateFile), configuration().runId);
}
export function saveState(state: TransferState) {
  writePrivateJson(stateFile, validateTransferState(state, configuration().runId), false);
}
function completeState() {
  const state = transferState();
  if (!state.source || !state.targetBefore || !state.dumpHash || !state.schema)
    fail('No complete source capture is available.');
  return {
    ...state,
    source: state.source,
    targetBefore: state.targetBefore,
    dumpHash: state.dumpHash,
    schema: state.schema,
  };
}
async function ownedClients() {
  const local = configuration();
  const source = client(local.sourceUrl);
  const target = client(local.targetUrl);
  try {
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
  } catch (error) {
    await source.$disconnect();
    await target.$disconnect();
    throw error;
  }
  return {
    local,
    source,
    target,
    async close() {
      await source.$disconnect();
      await target.$disconnect();
    },
  };
}
function adminSql(url: string, sql: string) {
  const environment = pgEnvironment(url);
  return captured(
    pgTool('psql'),
    ['-X', '--no-password', '--quiet', '--set', 'ON_ERROR_STOP=1', '--command', sql],
    {
      env: {
        ...environment,
        PGOPTIONS: `${environment.PGOPTIONS} -c default_transaction_read_only=off`,
      },
    },
  );
}
export function assertWriteFence(url: string) {
  if (psql(url, 'SHOW default_transaction_read_only').trim() !== 'on')
    fail('Database write fence is not active for new application connections.');
  const rejected = spawnSync(
    pgTool('psql'),
    [
      '-X',
      '--no-password',
      '--quiet',
      '--set',
      'ON_ERROR_STOP=1',
      '--set',
      'VERBOSITY=sqlstate',
      '--command',
      'UPDATE public."User" SET name = name WHERE false',
    ],
    { encoding: 'utf8', env: pgEnvironment(url), timeout: 10_000 },
  );
  if (rejected.status === 0 || !/\b25006\b/.test(rejected.stderr ?? ''))
    fail('Database did not reject a protected no-op write as read-only.');
}
function setFence(url: string, enabled: boolean) {
  const database = databaseIdentity(url).database;
  if (!['postgres', 'bondi_migration_source_test'].includes(database))
    fail('Unapproved rehearsal database write-fence target.');
  adminSql(
    url,
    `ALTER DATABASE "${database}" SET default_transaction_read_only = ${enabled ? 'on' : 'off'}`,
  );
  if (enabled) assertWriteFence(url);
  else if (psql(url, 'SHOW default_transaction_read_only').trim() !== 'off')
    fail('Database write-fence release failed.');
}
async function drainedSource(db: PrismaClient) {
  const [row] = await db.$queryRaw<
    Array<{ clients: number }>
  >`SELECT count(*)::int AS clients FROM pg_catalog.pg_stat_activity
    WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`;
  if (row.clients !== 0)
    fail('Source application connections must be drained before the maintenance write fence.');
}
export async function pauseJobs(db: PrismaClient) {
  await db.$executeRawUnsafe(`DO $$ DECLARE owned_job RECORD; BEGIN
    FOR owned_job IN SELECT jobid FROM cron.job WHERE jobname IN ('bondi-message-delivery', 'bondi-typing-retention') LOOP
      PERFORM cron.alter_job(owned_job.jobid, active := false);
    END LOOP; END $$`);
  const [row] = await db.$queryRaw<
    Array<{ active: number }>
  >`SELECT count(*)::int AS active FROM cron.job
    WHERE jobname IN ('bondi-message-delivery', 'bondi-typing-retention') AND active`;
  if (row.active !== 0) fail('Owned native jobs must be paused before restoring application data.');
}
async function fileHash() {
  const info = lstatSync(dumpFile);
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.mode & 0o077 ||
    (process.getuid && info.uid !== process.getuid())
  )
    fail('Source backup must remain a private owned regular file.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(dumpFile)) hash.update(chunk);
  return hash.digest('hex');
}
export async function captureSource() {
  if (existsSync(stateFile) || existsSync(dumpFile))
    fail(
      'A capture already exists; preserve its private state and use its explicit recovery flow.',
    );
  sessions();
  const owned = await ownedClients();
  try {
    const identities = await preflight(owned.local, owned.source, owned.target);
    await drainedSource(owned.source);
    const targetBefore = await snapshot(owned.target, owned.local.targetUrl);
    writePrivateJson(
      resolve(artifactRoot, 'target-bootstrap-ledger.json'),
      await ledger(owned.target),
    );
    const state: TransferState = {
      runId: owned.local.runId,
      phase: 'capturing',
      targetBefore,
      schema: identities.schema,
      failureProven: false,
      targetHttpProven: false,
      rollbackHttpProven: false,
      deliveryProven: false,
      createdAt: new Date().toISOString(),
    };
    writePrivateJson(stateFile, state);
    await pauseJobs(owned.target);
    setFence(owned.local.sourceUrl, true);
    setFence(owned.local.targetUrl, true);
    state.source = await snapshot(owned.source, owned.local.sourceUrl);
    exportData(owned.local.sourceUrl, dumpFile);
    state.dumpHash = await fileHash();
    state.phase = 'captured';
    saveState(state);
    console.log(
      'Captured populated application data privately; both databases reject writes, native jobs paused, target unselected.',
    );
  } finally {
    await owned.close();
  }
}
function restoreSql() {
  const guarded = tables
    .filter((table) => table !== '_prisma_migrations')
    .map(
      (table) =>
        `IF EXISTS (SELECT 1 FROM ${quoted(table)} LIMIT 1) THEN RAISE EXCEPTION 'Destination is populated'; END IF;`,
    )
    .join('\n');
  return `LOCK TABLE ${tables.map(quoted).join(', ')} IN ACCESS EXCLUSIVE MODE;
    DO $$ BEGIN ${guarded} END $$; DELETE FROM public._prisma_migrations;`;
}
async function unchangedSource(db: PrismaClient, url: string, expected: TableSnapshot) {
  if (!sameSnapshot(expected, await snapshot(db, url)))
    fail('Source changed after capture; do not select the stale target or reverse-switch writers.');
}
export async function restoreCaptured(injectFailure = false) {
  const state = completeState();
  if (state.phase !== 'captured' || (!injectFailure && !state.failureProven))
    fail('Restore requires a captured source and a proven failure rollback.');
  if ((await fileHash()) !== state.dumpHash) fail('Private source backup changed after capture.');
  const owned = await ownedClients();
  try {
    assertWriteFence(owned.local.sourceUrl);
    assertWriteFence(owned.local.targetUrl);
    await preflight(owned.local, owned.source, owned.target);
    await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
    if (!sameSnapshot(state.targetBefore, await snapshot(owned.target, owned.local.targetUrl)))
      fail('Target bootstrap changed after capture.');
    const environment = pgEnvironment(owned.local.targetUrl);
    const restored = spawnSync(
      pgTool('psql'),
      [
        '-X',
        '--no-password',
        '--quiet',
        '--set',
        'ON_ERROR_STOP=1',
        '--set',
        'VERBOSITY=sqlstate',
        '--single-transaction',
        '--command',
        restoreSql(),
        '--file',
        dumpFile,
        ...(injectFailure ? ['--command', 'SELECT 1 / 0'] : []),
      ],
      {
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        timeout: 600_000,
        env: {
          ...environment,
          PGOPTIONS: `${environment.PGOPTIONS} -c default_transaction_read_only=off`,
        },
      },
    );
    if (injectFailure) {
      if (restored.status === 0 || !/\b22012\b/.test(restored.stderr ?? ''))
        fail('Restore did not reach the injected post-copy failure; no rollback proof recorded.');
      await emptyApplication(owned.target);
      if (!sameSnapshot(state.targetBefore, await snapshot(owned.target, owned.local.targetUrl)))
        fail('Failed restore changed target rows or migration history.');
      await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
      state.failureProven = true;
      saveState(state);
      console.log(
        'Injected post-copy SQL failure rolled back every application row and the target ledger; source remains intact and target unselected.',
      );
      return;
    }
    if (restored.error || restored.status !== 0)
      fail(
        'Atomic application restore failed; private diagnostics omitted and target remains unselected.',
      );
    if (!sameSnapshot(state.source, await snapshot(owned.target, owned.local.targetUrl)))
      fail(
        'Restored row counts/content differ from the captured source; target remains fenced and unselected.',
      );
    await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
    if ((await schemaSignature(owned.target)) !== state.schema)
      fail('Target schema changed during restore.');
    await nativeBoundaries(owned.target);
    await ledger(owned.target);
    assertWriteFence(owned.local.sourceUrl);
    assertWriteFence(owned.local.targetUrl);
    state.phase = 'verified';
    saveState(state);
    console.log(
      'Atomic transfer verified: all 18 application tables match exact source counts/content, including original migration ledger; both writers remain fenced.',
    );
  } finally {
    await owned.close();
  }
}
export async function rollbackBeforeWrites() {
  const state = transferState();
  if (!['capturing', 'captured', 'verified'].includes(state.phase))
    fail(
      'Rollback is refused after target writes may have been accepted; reconcile data explicitly.',
    );
  const owned = await ownedClients();
  try {
    if (state.source) await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
    else {
      await emptyApplication(owned.target);
      setFence(owned.local.targetUrl, true);
    }
    assertWriteFence(owned.local.targetUrl);
    setFence(owned.local.sourceUrl, false);
    psql(owned.local.sourceUrl, 'UPDATE public."User" SET name = name WHERE false');
    state.phase = 'rolled-back';
    saveState(state);
    console.log(
      'Before-write rollback restored only the source writer; target stays read-only and its jobs stay paused.',
    );
  } finally {
    await owned.close();
  }
}
export async function reselectTarget() {
  const state = completeState();
  if (state.phase !== 'rolled-back' || !state.rollbackHttpProven)
    fail('Re-selection requires actual source HTTP qualification after rollback.');
  const owned = await ownedClients();
  try {
    await drainedSource(owned.source);
    setFence(owned.local.sourceUrl, true);
    assertWriteFence(owned.local.targetUrl);
    await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
    if (!sameSnapshot(state.source, await snapshot(owned.target, owned.local.targetUrl)))
      fail('Target no longer matches the captured source.');
    state.phase = 'verified';
    saveState(state);
    console.log(
      'Re-selected the verified read-only target after proving the rollback source unchanged; both writers fenced.',
    );
  } finally {
    await owned.close();
  }
}
export async function acceptTargetWrites() {
  const state = completeState();
  if (
    state.phase !== 'verified' ||
    !state.failureProven ||
    !state.targetHttpProven ||
    !state.rollbackHttpProven
  )
    fail(
      'Target write acceptance requires transfer, failure rollback and actual target/source HTTP qualification.',
    );
  const owned = await ownedClients();
  try {
    assertWriteFence(owned.local.sourceUrl);
    assertWriteFence(owned.local.targetUrl);
    await unchangedSource(owned.source, owned.local.sourceUrl, state.source);
    if (!sameSnapshot(state.source, await snapshot(owned.target, owned.local.targetUrl)))
      fail('Target changed before write acceptance.');
    state.phase = 'accepting';
    saveState(state);
    setFence(owned.local.targetUrl, false);
    psql(owned.local.targetUrl, 'UPDATE public."User" SET name = name WHERE false');
    state.phase = 'accepted';
    saveState(state);
    console.log(
      'Accepted the target as the sole writer. Source remains fenced; simple rollback is now refused. Native jobs await explicit delivery recovery.',
    );
  } finally {
    await owned.close();
  }
}
