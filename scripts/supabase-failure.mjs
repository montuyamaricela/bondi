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

export function supabaseFailureDetails(output, privateKeys) {
  let redacted = output;
  for (const key of privateKeys) {
    if (!key || typeof key !== 'object') continue;
    for (const field of ['d', 'x', 'y', 'k', 'p', 'q', 'dp', 'dq', 'qi']) {
      if (typeof key[field] === 'string') redacted = redacted.replaceAll(key[field], '[redacted]');
    }
  }
  redacted = redacted
    .replace(/(?:https?|postgres(?:ql)?):\/\/[^\s"'<>]+/gi, '[endpoint]')
    .replace(/\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[api-key]')
    .replace(/(?:password|secret|authorization|apikey)\s*[=:]\s*[^\s,;}]+/gi, '[credential]')
    .replace(/[A-Za-z0-9_+/=-]{24,}/g, '[redacted]');
  return redacted
    .split('\n')
    .filter((line) => /fatal|error|unhealthy|not healthy|failed/i.test(line))
    .slice(-12)
    .map((line) => line.slice(0, 500));
}
