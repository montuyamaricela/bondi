import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';
import { publishRealtimeHint } from '@/lib/server/realtime';
import {
  chatOwnerInput,
  readMessagesInput,
  typingInput,
  type ChatOwner,
} from '@/app/components/features/messaging/activity-input';

export function assertChatOwner(owner: ChatOwner, input: unknown) {
  const value = chatOwnerInput.parse(input);
  if (owner.userId !== value.expectedUserId || owner.sessionId !== value.expectedSessionId)
    throw createAppError('Session changed', 409, 'SESSION_CHANGED');
}

export function assertOptionalChatOwner(owner: ChatOwner, input: unknown) {
  if (
    input &&
    typeof input === 'object' &&
    ('expectedUserId' in input || 'expectedSessionId' in input)
  )
    assertChatOwner(owner, input);
}

async function activeMatch(tx: Prisma.TransactionClient, owner: ChatOwner, matchId: string) {
  if (!matchId || matchId.length > 128) throw createAppError('Invalid match', 400);
  await tx.$queryRaw`SELECT id FROM public."Match" WHERE id = ${matchId} FOR UPDATE`;
  const match = await tx.match.findUnique({ where: { id: matchId } });
  if (!match) throw createAppError('Match not found', 404);
  if (match.status !== 'ACTIVE' || ![match.user1Id, match.user2Id].includes(owner.userId))
    throw createAppError('An active match is required', 403, 'LIVE_ACCESS_DENIED');
  const valid = await tx.session.findFirst({
    where: { id: owner.sessionId, userId: owner.userId, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (!valid) throw createAppError('Unauthorized', 401, 'UNAUTHORIZED');
  return match;
}

async function refreshParticipants(userIds: string[]) {
  await Promise.all(
    userIds.map((userId) =>
      publishRealtimeHint(userId).catch(() => {
        console.error('Chat activity refresh unavailable');
      }),
    ),
  );
}

export async function markChatRead(owner: ChatOwner, matchId: string, input: unknown) {
  const value = readMessagesInput.parse(input);
  assertChatOwner(owner, value);
  const outcome = await db.$transaction(async (tx) => {
    const match = await activeMatch(tx, owner, matchId);
    const ids = [...new Set(value.ids)];
    const messages = await tx.message.findMany({
      where: { id: { in: ids } },
      select: { id: true, matchId: true },
    });
    if (messages.length !== ids.length || messages.some((message) => message.matchId !== matchId))
      throw createAppError('Messages unavailable', 403, 'LIVE_ACCESS_DENIED');
    const updated = await tx.message.updateMany({
      where: { id: { in: ids }, matchId, senderId: { not: owner.userId }, readAt: null },
      data: { readAt: new Date() },
    });
    const receipts = await tx.message.findMany({
      where: { id: { in: ids }, matchId, senderId: { not: owner.userId }, readAt: { not: null } },
      select: { id: true, readAt: true },
    });
    return { count: updated.count, receipts, users: [match.user1Id, match.user2Id] };
  });
  if (outcome.count) await refreshParticipants(outcome.users);
  return { updated: outcome.count, receipts: outcome.receipts };
}

export async function writeChatTyping(owner: ChatOwner, matchId: string, input: unknown) {
  const value = typingInput.parse(input);
  assertChatOwner(owner, value);
  const outcome = await db.$transaction(async (tx) => {
    const match = await activeMatch(tx, owner, matchId);
    await tx.$queryRaw`SELECT id FROM public."RealtimeLease"
      WHERE id = ${value.leaseId} AND "userId" = ${owner.userId} AND "sessionId" = ${owner.sessionId}
      FOR SHARE`;
    const lease = await tx.realtimeLease.findFirst({
      where: {
        id: value.leaseId,
        userId: owner.userId,
        sessionId: owner.sessionId,
        expiresAt: { gt: new Date() },
      },
      include: { session: { select: { expiresAt: true } } },
    });
    if (!lease) throw createAppError('Subscription expired', 409, 'SUBSCRIPTION_EXPIRED');
    const expiresAt = value.typing
      ? new Date(
          Math.min(Date.now() + 5000, lease.expiresAt.getTime(), lease.session.expiresAt.getTime()),
        )
      : new Date(0);
    const changed = await tx.$executeRaw`
      INSERT INTO public."TypingLease" ("leaseId", "matchId", "viewId", "sequence", "expiresAt")
      VALUES (${lease.id}, ${match.id}, ${value.viewId}::uuid, ${value.sequence}, ${expiresAt.toISOString()}::timestamp)
      ON CONFLICT ("leaseId", "matchId", "viewId") DO UPDATE
      SET "sequence" = EXCLUDED."sequence", "expiresAt" = EXCLUDED."expiresAt"
      WHERE public."TypingLease"."sequence" < EXCLUDED."sequence"`;
    return { changed: changed > 0, users: [match.user1Id, match.user2Id] };
  });
  if (outcome.changed) await refreshParticipants(outcome.users);
  return { accepted: outcome.changed };
}

export async function readChatTyping(owner: ChatOwner, matchId: string, input: unknown) {
  assertChatOwner(owner, input);
  return db.$transaction(async (tx) => {
    const match = await activeMatch(tx, owner, matchId);
    const peerId = match.user1Id === owner.userId ? match.user2Id : match.user1Id;
    const now = new Date();
    const [state] = await tx.$queryRaw<Array<{ expiresAt: Date | null }>>`
      SELECT max(least(t."expiresAt", l."expiresAt", s."expiresAt")) AS "expiresAt"
      FROM public."TypingLease" t
      JOIN public."RealtimeLease" l ON l.id = t."leaseId"
      JOIN public."Session" s ON s.id = l."sessionId" AND s."userId" = l."userId"
      WHERE t."matchId" = ${matchId} AND l."userId" = ${peerId}
        AND t."expiresAt" > ${now.toISOString()}::timestamp
        AND l."expiresAt" > ${now.toISOString()}::timestamp
        AND s."expiresAt" > ${now.toISOString()}::timestamp`;
    return {
      typing: !!state.expiresAt,
      expiresAt: state.expiresAt?.toISOString() ?? null,
    };
  });
}
