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
  const keys = Array.from({ length: 2 }, () => ({
    ...generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' }),
    kid: randomUUID(),
    alg: 'ES256',
    use: 'sig',
    key_ops: ['sign', 'verify'],
    ext: true,
  }));
  writeFileSync(path, JSON.stringify(keys), { mode: 0o600, flag: 'wx' });
}
const keys = JSON.parse(readFileSync(path, 'utf8'));
if (
  !Array.isArray(keys) ||
  keys.length !== 2 ||
  keys.some(
    (key) => key.alg !== 'ES256' || key.kty !== 'EC' || key.crv !== 'P-256' || !key.kid || !key.d,
  )
) {
  console.error('The owned local key file must contain two private ES256 signing keys.');
  process.exit(1);
}
chmodSync(path, 0o600);
console.log('Prepared private ignored local signing keys; no keys were printed or rotated.');
