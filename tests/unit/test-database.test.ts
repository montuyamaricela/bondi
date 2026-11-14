import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNativeMarker, assertTestDatabase } from '../helpers/test-database';

const local = { DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:5432/bondi_harness' };
const native = {
  DATABASE_URL: 'postgresql://postgres:synthetic@127.0.0.1:54322/postgres',
  DIRECT_URL: 'postgresql://postgres:synthetic@127.0.0.1:54322/postgres',
  BONDI_TEST_PROJECT: 'bondi-integration',
  BONDI_TEST_CONFIRM: 'bondi-integration/postgres',
  BONDI_TEST_MARKER: 'a'.repeat(64),
  SUPABASE_TEST_URL: 'http://127.0.0.1:54321',
};

test('ordinary local test names remain protected without requiring native services', () => {
  assert.deepEqual(assertTestDatabase(local), { native: false, url: local.DATABASE_URL });
  for (const value of ['postgres', 'production', 'mytestaccount'])
    assert.throws(() =>
      assertTestDatabase({ DATABASE_URL: local.DATABASE_URL.replace('bondi_harness', value) }),
    );
});

test('a generic allow flag or postgres name cannot bypass database protection', () => {
  assert.throws(() =>
    assertTestDatabase({ DATABASE_URL: native.DATABASE_URL, ALLOW_TEST_DATABASE: 'true' }),
  );
  for (const key of [
    'BONDI_TEST_PROJECT',
    'BONDI_TEST_CONFIRM',
    'BONDI_TEST_MARKER',
    'SUPABASE_TEST_URL',
  ])
    assert.throws(() => assertTestDatabase({ ...native, [key]: undefined }));
});

test('native tests reject mismatched project, API, marker, database and direct target', () => {
  for (const invalid of [
    { BONDI_TEST_PROJECT: 'another-project' },
    { BONDI_TEST_MARKER: '' },
    { SUPABASE_TEST_URL: 'https://production.supabase.co' },
    { DATABASE_URL: native.DATABASE_URL.replace(':54322', ':5432') },
    { DATABASE_URL: native.DATABASE_URL.replace(/\/postgres$/, '/production') },
    { DIRECT_URL: native.DIRECT_URL.replace('127.0.0.1', 'production.example') },
    { DIRECT_URL: native.DIRECT_URL.replace(/\/postgres$/, '/another_test') },
  ])
    assert.throws(() => assertTestDatabase({ ...native, ...invalid }));
});

test('marker verification requires the actual matching database record, not only environment flags', () => {
  const target = assertTestDatabase(native);
  assert.ok(target.native);
  assertNativeMarker(target, {
    project: target.project,
    nonce: target.marker,
    database: 'postgres',
  });
  for (const record of [
    undefined,
    { project: 'other', nonce: target.marker, database: 'postgres' },
    { project: target.project, nonce: 'b'.repeat(64), database: 'postgres' },
    { project: target.project, nonce: target.marker, database: 'production' },
  ])
    assert.throws(() => assertNativeMarker(target, record));
});

test('unsafe database failures do not echo a credential or raw URL', () => {
  for (const value of [
    'not-a-url:private-canary',
    'postgresql://synthetic:private-canary@production.example/test',
  ]) {
    assert.throws(
      () => assertTestDatabase({ DATABASE_URL: value }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('private-canary'));
        return true;
      },
    );
  }
});
