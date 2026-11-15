import assert from 'node:assert/strict';
import { test } from 'node:test';
import { realtimeEnvironment } from '../../lib/server/env';

test('Realtime activation requires private configuration without echoing values', () => {
  assert.throws(() => realtimeEnvironment({}), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(
    () =>
      realtimeEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
      }),
    /private signing-key/,
  );
  assert.throws(
    () =>
      realtimeEnvironment({
        NEXT_PUBLIC_SUPABASE_URL: 'secret-invalid-value',
      }),
    (error) => error instanceof Error && !error.message.includes('secret-invalid-value'),
  );
  assert.deepEqual(
    realtimeEnvironment({
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.test',
      SUPABASE_SIGNING_KEYS_PATH: 'private.json',
      SUPABASE_SECRET_KEY: 'private',
    }),
    {
      url: 'https://example.test',
      signingKeysPath: 'private.json',
      secretKey: 'private',
    },
  );
});
