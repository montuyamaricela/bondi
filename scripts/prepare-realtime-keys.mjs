import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { generateKeyPairSync, randomUUID } from 'node:crypto';

// Explicit local infrastructure setup only; never called by app build/test/start.
if (
  process.argv.slice(2).join(' ') !== '--confirm-project bondi-integration' ||
  !/^project_id\s*=\s*"bondi-integration"\s*$/m.test(readFileSync('supabase/config.toml', 'utf8'))
) {
  console.error('Confirm only the owned bondi-integration local signing-key setup.');
  process.exit(1);
}
const path = 'supabase/signing_keys.json';
if (!existsSync(path)) {
  const keys = Array.from({ length: 2 }, (_, index) => ({
    ...generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' }),
    kid: randomUUID(),
    alg: 'ES256',
    use: 'sig',
    key_ops: index === 0 ? ['sign', 'verify'] : ['verify'],
    ext: true,
  }));
  writeFileSync(path, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
}
let keys;
try {
  keys = JSON.parse(readFileSync(path, 'utf8'));
} catch {
  console.error('The private local signing-key file is invalid; its contents are omitted.');
  process.exit(1);
}
if (
  !Array.isArray(keys) ||
  keys.length !== 2 ||
  keys.some(
    (key) =>
      !key ||
      typeof key !== 'object' ||
      key.alg !== 'ES256' ||
      key.kty !== 'EC' ||
      key.crv !== 'P-256' ||
      !key.kid ||
      !key.d ||
      !key.x ||
      !key.y,
  ) ||
  !Array.isArray(keys[0]?.key_ops) ||
  !keys[0].key_ops.includes('sign') ||
  !Array.isArray(keys[1]?.key_ops) ||
  keys[1].key_ops.includes('sign') ||
  !keys[1].key_ops.includes('verify')
) {
  console.error(
    'Local ES256 keys require one active signer and one verification-only overlap key.',
  );
  process.exit(1);
}
chmodSync(path, 0o600);
console.log('Prepared private ignored local signing keys; no keys were printed or rotated.');
