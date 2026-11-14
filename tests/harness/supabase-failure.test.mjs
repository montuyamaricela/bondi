import assert from 'node:assert/strict';
import { test } from 'node:test';
import { supabaseFailureSymptoms } from '../../scripts/supabase-failure.mjs';

test('native setup diagnostics expose only fixed symptom names, never captured values', () => {
  const privateValue = 'synthetic-do-not-log-private-value';
  const result = supabaseFailureSymptoms(
    `supabase_auth is not healthy: failed to parse JWT keys: private key ${privateValue} key_ops`,
  );
  assert.deepEqual(result, [
    'JWT signing-key configuration',
    'key usage validation',
    'private-key validation',
    'Auth service',
    'unhealthy container',
    'configuration decoding',
  ]);
  assert.equal(JSON.stringify(result).includes(privateValue), false);
  assert.deepEqual(supabaseFailureSymptoms(privateValue), []);
});
