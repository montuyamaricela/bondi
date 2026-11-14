import assert from 'node:assert/strict';
import { test } from 'node:test';
import { configuredPort, configuredUrl } from '../../lib/configuration';
import {
  applicationEnvironment,
  authEnvironment,
  migrationDatabaseUrl,
  runtimeDatabaseUrl,
  socketEnvironment,
} from '../../lib/server/env';
import { publicSocketUrl } from '../../lib/client/env';

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

test('application and standalone ports stay distinct across all socket owners', () => {
  const environment = {
    PORT: '3100',
    SOCKET_PORT: '3101',
    HOSTNAME: '127.0.0.1',
    NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3100',
    NEXT_PUBLIC_SOCKET_URL: 'http://127.0.0.1:3101',
  };
  assert.deepEqual(applicationEnvironment(environment), {
    hostname: '127.0.0.1',
    port: 3100,
    dev: true,
    clientOrigin: 'http://127.0.0.1:3100',
  });
  assert.deepEqual(socketEnvironment(environment), {
    port: 3101,
    clientOrigin: 'http://127.0.0.1:3100',
  });
  assert.equal(applicationEnvironment({}).port, 3000);
  assert.equal(socketEnvironment({}).port, 3001);
  assert.throws(() => socketEnvironment({ NODE_ENV: 'production' }), /NEXT_PUBLIC_APP_URL/);
  assert.throws(() => applicationEnvironment({ HOSTNAME: 'https://bad.example/path' }), /HOSTNAME/);
  assert.throws(() => applicationEnvironment({ HOSTNAME: 'localhost:3100' }), /HOSTNAME/);
  assert.equal(applicationEnvironment({ HOSTNAME: '::1' }).hostname, '::1');
  assert.throws(
    () => socketEnvironment({ NEXT_PUBLIC_SOCKET_URL: 'javascript:invalid' }),
    /NEXT_PUBLIC_SOCKET_URL/,
  );
});

test('ports and public origins reject malformed or ambiguous configuration', () => {
  for (const value of ['', '0', '65536', '-1', '1.5', '3100x', ' 3100', 'Infinity'])
    assert.throws(() => configuredPort(value, 'PORT', 3000), /PORT must/);
  assert.equal(configuredPort('65535', 'PORT', 3000), 65535);
  assert.equal(configuredPort(undefined, 'PORT', 3000), 3000);
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

test('browser socket selection uses public settings or its current origin, never a localhost production fallback', () => {
  const currentOrigin = 'https://bondi.example';
  assert.equal(publicSocketUrl({}, currentOrigin), currentOrigin);
  assert.equal(
    publicSocketUrl({ appUrl: 'https://application.example/' }, currentOrigin),
    'https://application.example',
  );
  assert.equal(
    publicSocketUrl(
      { socketUrl: 'https://realtime.example', appUrl: 'https://application.example' },
      currentOrigin,
    ),
    'https://realtime.example',
  );
  assert.throws(() => publicSocketUrl({ socketUrl: '' }, currentOrigin), /NEXT_PUBLIC_SOCKET_URL/);
});
