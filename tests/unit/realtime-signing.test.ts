import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exportJWK, generateKeyPair, jwtVerify } from 'jose';
import { mintRealtimeToken } from '../../lib/server/realtime-signing';

test('imported ES256 keys sign verifiable text-ID session credentials with bounded expiry', async () => {
  const pair = await generateKeyPair('ES256', { extractable: true });
  const privateKey = {
    ...(await exportJWK(pair.privateKey)),
    kid: 'synthetic-key',
    alg: 'ES256',
    key_ops: ['sign', 'verify'],
  };
  const expiresAt = new Date(Date.now() + 90_000);
  const token = await mintRealtimeToken(
    { id: 'synthetic-lease', userId: 'text-user', sessionId: 'text-session', expiresAt },
    privateKey,
  );
  const verified = await jwtVerify(token, pair.publicKey, {
    issuer: 'bondi-realtime',
    audience: 'authenticated',
    algorithms: ['ES256'],
  });
  assert.equal(verified.payload.sub, 'text-user');
  assert.equal(verified.payload.bondi_session, 'text-session');
  assert.equal(verified.payload.bondi_lease, 'synthetic-lease');
  assert.equal(verified.payload.exp, Math.floor(expiresAt.getTime() / 1000));
  assert.equal(verified.protectedHeader.kid, 'synthetic-key');
  assert.equal(verified.payload.role, 'authenticated');
  await assert.rejects(jwtVerify(token, pair.publicKey, { issuer: 'other' }));
  await assert.rejects(jwtVerify(token, pair.publicKey, { audience: 'other' }));
  await assert.rejects(
    jwtVerify(token, pair.publicKey, { currentDate: new Date(expiresAt.getTime() + 1000) }),
  );
  const unrelated = await generateKeyPair('ES256');
  await assert.rejects(jwtVerify(token, unrelated.publicKey));
});
