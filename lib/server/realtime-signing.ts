import { importJWK, SignJWT, type JWK } from 'jose';

export const REALTIME_ISSUER = 'bondi-realtime';
export const REALTIME_LIFETIME_SECONDS = 90;

export async function mintRealtimeToken(
  lease: { id: string; userId: string; sessionId: string; expiresAt: Date },
  key: JWK & { kid: string },
) {
  // CLI-imported keys advertise sign + verify; private Web Crypto keys use sign only.
  const signingKey = await importJWK({ ...key, key_ops: ['sign'] }, 'ES256');
  return new SignJWT({
    role: 'authenticated',
    bondi_session: lease.sessionId,
    bondi_lease: lease.id,
  })
    .setProtectedHeader({ alg: 'ES256', kid: key.kid, typ: 'JWT' })
    .setIssuer(REALTIME_ISSUER)
    .setAudience('authenticated')
    .setSubject(lease.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(lease.expiresAt.getTime() / 1000))
    .sign(signingKey);
}
