import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configuredUrl } from '../../lib/configuration';
import { publicRealtimeConfiguration } from '../../lib/client/env';
import { authEnvironment, migrationDatabaseUrl, runtimeDatabaseUrl } from '../../lib/server/env';

const local = 'postgresql://synthetic:synthetic@127.0.0.1:5432/bondi_test?schema=public';
const pooled =
  'postgresql://synthetic:synthetic@aws-0-test.pooler.supabase.com:6543/postgres?pgbouncer=true';
const direct = 'postgresql://synthetic:synthetic@db.synthetic.supabase.co:5432/postgres';
const secret = 'synthetic-configuration-secret-at-least-32';

test('runtime and migration connections remain separate and ordinary local setup stays valid', () => {
  assert.equal(runtimeDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: direct }), pooled);
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: pooled, DIRECT_URL: direct }), direct);
  assert.equal(runtimeDatabaseUrl({ DATABASE_URL: local }), local);
  assert.equal(migrationDatabaseUrl({ DATABASE_URL: local }), local);
  assert.equal(migrationDatabaseUrl({ DIRECT_URL: direct }), direct);
  assert.equal(
    migrationDatabaseUrl({ DIRECT_URL: direct, DATABASE_URL: 'unrelated invalid runtime' }),
    direct,
  );
});

test('migration connections reject transaction pooling instead of silently reusing it', () => {
  for (const value of [
    pooled,
    pooled.replace('?pgbouncer=true', ''),
    pooled.replace('pooler.supabase.com', 'POOLER.SUPABASE.COM').replace('?pgbouncer=true', ''),
    local + '&pgbouncer=true',
    local + '&pgbouncer=false&pgbouncer=true',
    local + '&pool_mode=transaction',
  ]) {
    assert.throws(
      () => migrationDatabaseUrl({ DATABASE_URL: value }),
      /DIRECT_URL.*transaction pooling/,
    );
    assert.throws(
      () => migrationDatabaseUrl({ DATABASE_URL: local, DIRECT_URL: value }),
      /DIRECT_URL.*transaction pooling/,
    );
  }
  assert.throws(
    () => migrationDatabaseUrl({ DATABASE_URL: local, DIRECT_URL: '' }),
    /DIRECT_URL must/,
  );
  const session = pooled.replace(':6543', ':5432').replace('?pgbouncer=true', '');
  assert.equal(migrationDatabaseUrl({ DIRECT_URL: session }), session);
});

test('configuration failures name settings without echoing private URL values', () => {
  for (const value of [
    undefined,
    '',
    ' ',
    'https://synthetic:private-canary@invalid/db',
    'postgresql://synthetic:private-canary@host:bad/db',
    'postgresql://synthetic:private-canary@host/',
    local + '#private-canary',
  ]) {
    assert.throws(
      () => runtimeDatabaseUrl({ DATABASE_URL: value }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /DATABASE_URL must/);
        assert.ok(
          !JSON.stringify({ message: error.message, stack: error.stack }).includes(
            'private-canary',
          ),
        );
        return true;
      },
    );
  }
});

test('auth requires a strong secret and explicit production origin without unrelated database settings', () => {
  assert.deepEqual(authEnvironment({ BETTER_AUTH_SECRET: secret }), {
    secret,
    baseURL: 'http://localhost:3000',
  });
  assert.deepEqual(
    authEnvironment({
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: secret,
      BETTER_AUTH_URL: 'https://bondi.example/',
    }),
    { secret, baseURL: 'https://bondi.example' },
  );
  for (const value of [undefined, '', 'short', ' '.repeat(40)])
    assert.throws(() => authEnvironment({ BETTER_AUTH_SECRET: value }), /BETTER_AUTH_SECRET/);
  assert.throws(
    () => authEnvironment({ NODE_ENV: 'production', BETTER_AUTH_SECRET: secret }),
    /BETTER_AUTH_URL/,
  );
  assert.throws(
    () => authEnvironment({ BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: '' }),
    /BETTER_AUTH_URL/,
  );
});

test('public origins reject malformed or ambiguous configuration', () => {
  for (const value of [
    'ftp://example.test',
    'https://user:private-canary@example.test',
    'https://example.test/path',
    'https://example.test?key=private-canary',
    'https://example.test#private-canary',
  ])
    assert.throws(
      () => configuredUrl(value, 'PUBLIC_ORIGIN'),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.message, 'PUBLIC_ORIGIN must be a valid HTTP(S) origin.');
        return true;
      },
    );
});

test('the browser has one validated Realtime configuration and degrades when it is absent', () => {
  assert.equal(publicRealtimeConfiguration({}), null);
  assert.deepEqual(
    publicRealtimeConfiguration({
      url: 'https://realtime.example/',
      key: 'sb_publishable_synthetic',
    }),
    {
      url: 'https://realtime.example',
      key: 'sb_publishable_synthetic',
    },
  );
  for (const settings of [
    { url: 'https://realtime.example' },
    { key: 'sb_publishable_synthetic' },
    { url: 'https://realtime.example', key: 'sb_secret_private-canary' },
    { url: 'javascript:private-canary', key: 'sb_publishable_synthetic' },
  ])
    assert.throws(
      () => publicRealtimeConfiguration(settings),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!error.message.includes('private-canary'));
        return true;
      },
    );
});
