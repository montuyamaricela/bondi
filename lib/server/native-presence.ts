import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import { publishRealtimeHint } from './realtime';
import { activePeerIds } from './match-access';
import {
  presenceWriteInput,
  type PresenceSnapshot,
} from '@/app/components/features/messaging/presence-input';

export async function notifyPresenceChange(userId: string) {
  try {
    const peers = await activePeerIds(userId);
    await Promise.all(peers.map((peerId) => publishRealtimeHint(peerId)));
  } catch {
    console.error('Online status refresh unavailable');
  }
}

export async function writePresence(
  owner: { userId: string; sessionId: string },
  input: unknown,
  online: boolean,
) {
  const value = presenceWriteInput.parse(input);
  if (value.expectedUserId !== owner.userId || value.expectedSessionId !== owner.sessionId)
    throw createAppError('Session changed', 409, 'SESSION_CHANGED');
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public."RealtimeLease"
      WHERE id = ${value.leaseId} AND "userId" = ${owner.userId} AND "sessionId" = ${owner.sessionId}
      FOR UPDATE`;
    const now = new Date();
    const lease = await tx.realtimeLease.findFirst({
      where: { id: value.leaseId, userId: owner.userId, sessionId: owner.sessionId },
      include: { session: { select: { userId: true, expiresAt: true } } },
    });
    if (!lease || lease.expiresAt <= now)
      throw createAppError('Subscription expired', 409, 'SUBSCRIPTION_EXPIRED');
    if (lease.session.userId !== owner.userId || lease.session.expiresAt <= now)
      throw createAppError('Unauthorized', 401, 'UNAUTHORIZED');
    if (lease.presenceSequence >= value.sequence) return { accepted: false, changed: false };
    const presenceExpiresAt = online
      ? new Date(
          Math.min(
            Date.now() + 60_000,
            lease.expiresAt.getTime(),
            lease.session.expiresAt.getTime(),
          ),
        )
      : null;
    await tx.realtimeLease.update({
      where: { id: lease.id },
      data: { presenceSequence: value.sequence, presenceExpiresAt },
    });
    return {
      accepted: true,
      changed: !!presenceExpiresAt !== !!(lease.presenceExpiresAt && lease.presenceExpiresAt > now),
    };
  });
  if (outcome.changed) await notifyPresenceChange(owner.userId);
  return { accepted: outcome.accepted };
}

export async function getNativePresence(
  viewerId: string,
  requested: string[],
): Promise<PresenceSnapshot> {
  const result: PresenceSnapshot = Object.fromEntries(
    requested.map((id) => [id, { visible: false, online: false }]),
  );
  if (!requested.length) return result;
  const peers = await activePeerIds(viewerId, requested);
  const now = new Date();
  const [profiles, leases] = await Promise.all([
    db.profile.findMany({
      where: { userId: { in: peers }, showOnlineStatus: true },
      select: { userId: true },
    }),
    db.realtimeLease.findMany({
      where: {
        userId: { in: peers },
        expiresAt: { gt: now },
        presenceExpiresAt: { gt: now },
        session: { expiresAt: { gt: now } },
      },
      select: { userId: true, session: { select: { userId: true } } },
    }),
  ]);
  const online = new Set(
    leases.filter((lease) => lease.userId === lease.session.userId).map((lease) => lease.userId),
  );
  for (const profile of profiles)
    result[profile.userId] = { visible: true, online: online.has(profile.userId) };
  return result;
}
