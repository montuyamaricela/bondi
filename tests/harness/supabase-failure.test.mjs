import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  supabaseFailureDetails,
  supabaseFailureSymptoms,
} from '../../scripts/supabase-failure.mjs';

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

test('failure details redact private JWK fields, endpoints, tokens and API keys before truncation', () => {
  const privateValue = 'short-private-scalar';
  const token = 'eyJheader.payload-signature-data.signature-data';
  const apiKey = 'sb_secret_synthetic-secret-value';
  const endpoint = 'postgresql://owner:short-password@localhost/private';
  const result = supabaseFailureDetails(
    `normal output ${apiKey}\nfatal: cannot decode JWK d=${privateValue}, token=${token}, apikey=${apiKey}, url=${endpoint}\nerror unsupported algorithm`,
    [{ d: privateValue }],
  ).join('\n');
  for (const secret of [privateValue, token, apiKey, endpoint, 'short-password'])
    assert.equal(result.includes(secret), false);
  assert.match(result, /cannot decode JWK/);
  assert.match(result, /unsupported algorithm/);
  assert.equal(result.includes('normal output'), false);
});
