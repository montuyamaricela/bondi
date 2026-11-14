// Report known symptom names, never captured CLI/container output or credentials.
export function supabaseFailureSymptoms(output) {
  return [
    ['JWT signing-key configuration', /signing.?keys?|jwt.?keys?|jwks/i],
    ['key usage validation', /key_ops|key operations|key usage/i],
    ['private-key validation', /private key|invalid key|failed to parse.*key/i],
    [
      'unsupported algorithm or curve',
      /unsupported.*(?:algorithm|curve|key)|invalid.*(?:algorithm|curve)/i,
    ],
    ['Auth service', /gotrue|supabase_auth|auth.*(?:health|fail|error)/i],
    ['REST service', /postgrest|supabase_rest/i],
    ['Realtime service', /supabase_realtime|realtime.*(?:health|fail|error)/i],
    ['unhealthy container', /unhealthy|not healthy|health check failed|failed.*health/i],
    [
      'configuration decoding',
      /failed to (?:parse|decode|load)|invalid config|configuration.*error/i,
    ],
    ['image download', /pull access denied|failed to pull|manifest unknown|toomanyrequests/i],
    ['Docker daemon unavailable', /cannot connect.*docker|docker daemon.*(?:running|unavailable)/i],
    ['port conflict', /address already in use|port is already allocated/i],
    ['disk exhausted', /no space left|disk quota exceeded/i],
  ]
    .filter(([, pattern]) => pattern.test(output))
    .map(([name]) => name);
}
