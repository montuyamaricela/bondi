import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import { realtimeEnvironment } from '@/lib/server/env';
import { mintRealtimeToken, REALTIME_LIFETIME_SECONDS } from '@/lib/server/realtime-signing';

export const realtimeOwnerInput = z
  .object({
    expectedUserId: z.string().min(1).max(128),
    expectedSessionId: z.string().min(1).max(128),
    leaseId: z.string().min(1).max(128).optional(),
  })
  .strict();

const signingKeySchema = z
  .object({
    kty: z.literal('EC'),
    crv: z.literal('P-256'),
    alg: z.literal('ES256'),
    kid: z.string().min(1),
    d: z.string().min(1),
    x: z.string().min(1),
    y: z.string().min(1),
  })
  .passthrough();

export async function signRealtimeCredential(
  lease: { id: string; userId: string; sessionId: string; expiresAt: Date },
  keyIndex = 0,
) {
  const configuration = realtimeEnvironment();
  let key;
  try {
    const keys = z
      .array(signingKeySchema)
      .min(1)
      .parse(JSON.parse(await readFile(configuration.signingKeysPath, 'utf8')));
    key = signingKeySchema.parse(keys[keyIndex]);
  } catch {
    throw new Error('Supabase Realtime signing-key configuration is invalid.');
  }
  return mintRealtimeToken(lease, key);
}

export async function issueRealtimeCredential(
  owner: { userId: string; sessionId: string },
  input: z.infer<typeof realtimeOwnerInput>,
) {
  realtimeEnvironment();
  if (input.expectedUserId !== owner.userId || input.expectedSessionId !== owner.sessionId)
    throw createAppError('Session changed', 409, 'SESSION_CHANGED');
  const lease = await db.$transaction(async (tx) => {
    const session = await tx.session.findFirst({
      where: {
        id: owner.sessionId,
        userId: owner.userId,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw createAppError('Unauthorized', 401, 'UNAUTHORIZED');
    const expiresAt = new Date(
      Math.min(session.expiresAt.getTime(), Date.now() + REALTIME_LIFETIME_SECONDS * 1000),
    );
    if (input.leaseId) {
      const existing = await tx.realtimeLease.findFirst({
        where: {
          id: input.leaseId,
          userId: owner.userId,
          sessionId: owner.sessionId,
          expiresAt: { gt: new Date() },
        },
      });
      if (!existing) throw createAppError('Subscription expired', 409, 'SUBSCRIPTION_EXPIRED');
      return tx.realtimeLease.update({ where: { id: existing.id }, data: { expiresAt } });
    }
    await tx.realtimeLease.deleteMany({
      where: { sessionId: owner.sessionId, expiresAt: { lte: new Date() } },
    });
    return tx.realtimeLease.create({
      data: {
        ...owner,
        topic: `bondi:${randomBytes(32).toString('hex')}`,
        expiresAt,
      },
    });
  });
  return {
    userId: lease.userId,
    sessionId: lease.sessionId,
    leaseId: lease.id,
    topic: lease.topic,
    expiresAt: lease.expiresAt.toISOString(),
    token: await signRealtimeCredential(lease),
  };
}

// Never publish private content: native channel permissions can outlive a session.
export async function publishRealtimeHint(userId: string) {
  const { url, secretKey } = realtimeEnvironment();
  const now = new Date();
  const leases = await db.realtimeLease.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
      session: { userId, expiresAt: { gt: now } },
    },
    select: { topic: true },
  });
  if (!leases.length) return;
  for (let index = 0; index < leases.length; index += 100) {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        apikey: secretKey,
        'Content-Type': 'application/json',
        ...(secretKey.startsWith('eyJ') ? { Authorization: `Bearer ${secretKey}` } : {}),
      },
      body: JSON.stringify({
        messages: leases
          .slice(index, index + 100)
          .map(({ topic }) => ({ topic, event: 'changed', payload: {}, private: true })),
      }),
    });
    await response.body?.cancel();
    if (!response.ok) throw new Error('Supabase invalidation was not accepted.');
  }
}
