import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  confirmProject,
  databaseIdentity,
  quoted,
  pgEnvironment,
  tables,
  writePrivateJson,
  readPrivateJson,
  validateConfiguration,
} from '../../scripts/migration/environment';

import { sameSnapshot } from '../../scripts/migration/snapshot';
import { validateTransferState } from '../../scripts/migration/transfer';

const valid = {
  project: 'bondi-migration-rehearsal',
  runId: '2a4cbe35-b191-4e45-8154-91a48c900444',
  nonce: 'a'.repeat(64),
  sourceUrl: 'postgresql://synthetic:private-canary@127.0.0.1:54329/bondi_migration_source_test',
  targetUrl: 'postgresql://synthetic:private-canary@127.0.0.1:54332/postgres',
  apiUrl: 'http://127.0.0.1:54331',
  publicKey: 'sb_publishable_synthetic',
  secretKey: 'sb_secret_private-canary',
  authSecret: 'synthetic-private-canary'.repeat(2),
  createdAt: '2026-11-15T00:00:00.000Z',
};
function redactedFailure(callback: () => unknown) {
  assert.throws(callback, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.ok(!error.message.includes('private-canary'));
    return true;
  });
}

test('rehearsal accepts only the explicitly isolated local source, target and API project', () => {
  assert.equal(validateConfiguration(valid).project, valid.project);
  const legacyAnon =
    'e30.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.signature';
  assert.equal(validateConfiguration({ ...valid, publicKey: legacyAnon }).publicKey, legacyAnon);
  for (const patch of [
    { sourceUrl: valid.targetUrl },
    { targetUrl: valid.sourceUrl },
    { sourceUrl: valid.sourceUrl.replace('54329', '5432') },
    { sourceUrl: valid.sourceUrl.replace('bondi_migration_source_test', 'production') },
    { targetUrl: valid.targetUrl.replace('54332', '54322') },
    { targetUrl: valid.targetUrl.replace('127.0.0.1', 'localhost') },
    { targetUrl: valid.targetUrl.replace('127.0.0.1', 'hosted.supabase.co') },
    { targetUrl: `${valid.targetUrl}?pgbouncer=true` },
    { apiUrl: 'http://127.0.0.1:54321' },
    { project: 'bondi-integration' },
    { publicKey: 'sb_secret_private-canary' },
    {
      publicKey:
        'e30.' +
        Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') +
        '.signature',
    },
    { nonce: '' },
    { secretKey: '' },
    { runId: 'unconfirmed' },
  ])
    redactedFailure(() => validateConfiguration({ ...valid, ...patch }));
  redactedFailure(() => databaseIdentity('private-canary'));
  redactedFailure(() => databaseIdentity('postgresql://127.0.0.1:54332/postgres'));
});

test('rehearsal requires explicit confirmation and never quotes native or unreviewed tables', () => {
  confirmProject(['--confirm-project', valid.project]);
  for (const args of [
    [],
    ['--confirm-project', 'bondi-integration'],
    ['--production'],
    ['--confirm-project', valid.project, '--force'],
  ])
    redactedFailure(() => confirmProject(args));
  assert.equal(quoted('MessageDelivery'), 'public."MessageDelivery"');
  for (const table of [
    'auth.users',
    'realtime.messages',
    'storage.objects',
    'Unknown',
    'User";DROP SCHEMA public;',
  ])
    redactedFailure(() => quoted(table));
});

test('private migration artifacts reject readable files and symlinks without echoing their contents', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-migration-guard-'));
  try {
    const file = join(directory, 'private.json');
    writeFileSync(file, JSON.stringify({ value: 'private-canary' }), { mode: 0o600 });
    assert.deepEqual(readPrivateJson(file), { value: 'private-canary' });
    chmodSync(file, 0o644);
    redactedFailure(() => readPrivateJson(file));
    chmodSync(file, 0o600);
    const link = join(directory, 'linked.json');
    symlinkSync(file, link);
    redactedFailure(() => readPrivateJson(link));
    const invalid = join(directory, 'invalid.json');
    writeFileSync(invalid, 'private-canary', { mode: 0o600 });
    redactedFailure(() => readPrivateJson(invalid));
    mkdirSync(join(directory, 'not-a-file'));
    redactedFailure(() => readPrivateJson(join(directory, 'not-a-file')));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('migration subprocess connections ignore inherited libpq redirection and service settings', () => {
  const previous = { PGHOSTADDR: process.env.PGHOSTADDR, PGSERVICE: process.env.PGSERVICE };
  try {
    process.env.PGHOSTADDR = 'private-canary';
    process.env.PGSERVICE = 'private-canary';
    const isolated = pgEnvironment(valid.sourceUrl);
    assert.equal(isolated.PGHOST, '127.0.0.1');
    assert.equal(isolated.PGPORT, '54329');
    assert.equal(isolated.PGDATABASE, 'bondi_migration_source_test');
    assert.ok(!('PGHOSTADDR' in isolated));
    assert.ok(!('PGSERVICE' in isolated));
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('data comparison requires every reviewed table and both its row count and full content fingerprint', () => {
  const complete = Object.fromEntries(
    tables.map((name) => [name, { count: '0', sha256: 'a'.repeat(64) }]),
  );
  assert.equal(sameSnapshot(complete, complete), true);
  assert.equal(sameSnapshot({}, {}), false);
  assert.equal(
    sameSnapshot(complete, { ...complete, User: { count: '1', sha256: 'a'.repeat(64) } }),
    false,
  );
  assert.equal(
    sameSnapshot(complete, { ...complete, Message: { count: '0', sha256: 'b'.repeat(64) } }),
    false,
  );
});

test('migration state replacement refuses symlinks and atomically retains private file permissions', () => {
  const directory = mkdtempSync(join(tmpdir(), 'bondi-migration-state-'));
  try {
    const path = join(directory, 'state.json');
    writePrivateJson(path, { state: 'prepared' });
    writePrivateJson(path, { state: 'verified' }, false);
    assert.deepEqual(readPrivateJson(path), { state: 'verified' });
    redactedFailure(() => writePrivateJson(path, { state: 'overwritten' }));
    const link = join(directory, 'state-link.json');
    symlinkSync(path, link);
    redactedFailure(() => writePrivateJson(link, { state: 'overwritten' }, false));
    assert.deepEqual(readPrivateJson(path), { state: 'verified' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a phase flag cannot bypass full capture, failure rollback or actual HTTP qualification evidence', () => {
  const rows = Object.fromEntries(
    tables.map((name) => [name, { count: '0', sha256: 'a'.repeat(64) }]),
  );
  const capture = {
    runId: valid.runId,
    phase: 'captured',
    source: rows,
    targetBefore: rows,
    dumpHash: 'b'.repeat(64),
    schema: 'c'.repeat(64),
    createdAt: valid.createdAt,
  };
  assert.equal(validateTransferState(capture, valid.runId).phase, 'captured');
  for (const input of [
    { ...capture, source: {} },
    { ...capture, dumpHash: undefined },
    { ...capture, phase: 'verified' },
    { ...capture, phase: 'accepted', failureProven: true },
    { ...capture, phase: 'accepting', failureProven: true, targetHttpProven: true },
  ])
    redactedFailure(() => validateTransferState(input, valid.runId));
  assert.equal(
    validateTransferState(
      {
        ...capture,
        phase: 'accepted',
        failureProven: true,
        targetHttpProven: true,
        rollbackHttpProven: true,
      },
      valid.runId,
    ).phase,
    'accepted',
  );
  redactedFailure(() => validateTransferState(capture, 'another-run'));
});
