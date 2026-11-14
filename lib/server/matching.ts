import { setTimeout as delay } from 'node:timers/promises';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAppError } from '@/lib/errors';

export async function recordDiscoveryAction(
  userId: string,
  targetUserId: string,
  action: 'LIKE' | 'PASS',
) {
  if (userId === targetUserId) throw createAppError('Cannot interact with your own profile', 400);
  const [user1Id, user2Id] = [userId, targetUserId].sort();
  const pairKey = `bondi:match:${JSON.stringify([user1Id, user2Id])}`;
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(
        async (transaction) => {
          // Wait for this pair's previous writer before taking fresh READ COMMITTED snapshots.
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))`;
          const target = await transaction.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, profile: { select: { name: true } } },
          });
          if (!target?.profile) throw createAppError('Target user not found', 404);
          const existingLike = await transaction.like.findUnique({
            where: { userId_targetUserId: { userId, targetUserId } },
          });
          if (existingLike && existingLike.action !== action)
            throw createAppError('You have already interacted with this profile', 400);
          if (!existingLike)
            await transaction.like.create({ data: { userId, targetUserId, action } });
          const noMatch = { response: { matched: false as const }, notify: [] };
          if (action === 'PASS') return noMatch;
          const reciprocal = await transaction.like.findUnique({
            where: { userId_targetUserId: { userId: targetUserId, targetUserId: userId } },
          });
          if (reciprocal?.action !== 'LIKE') return noMatch;

          let match = await transaction.match.findFirst({
            where: {
              OR: [
                { user1Id: userId, user2Id: targetUserId },
                { user1Id: targetUserId, user2Id: userId },
              ],
            },
          });
          if (match && match.status !== 'ACTIVE') return noMatch;
          if (!match) {
            match = await transaction.match.create({
              data: { user1Id, user2Id, status: 'ACTIVE' },
            });
          }
          const currentProfile = await transaction.profile.findUnique({
            where: { userId },
            select: { name: true },
          });
          const currentPhoto = await transaction.file.findFirst({
            where: { userId },
            orderBy: { order: 'asc' },
            select: { url: true },
          });
          const targetPhoto = await transaction.file.findFirst({
            where: { userId: targetUserId },
            orderBy: { order: 'asc' },
            select: { url: true },
          });
          const existingNotifications = await transaction.notification.findMany({
            where: { entityId: match.id, type: 'MATCH', userId: { in: [userId, targetUserId] } },
            select: { userId: true },
          });
          const notifications = [
            { userId, content: `You matched with ${target.profile.name}!` },
            {
              userId: targetUserId,
              content: `You matched with ${currentProfile?.name || 'someone'}!`,
            },
          ].filter(
            (recipient) =>
              !existingNotifications.some((existing) => existing.userId === recipient.userId),
          );
          if (notifications.length)
            await transaction.notification.createMany({
              data: notifications.map((notification) => ({
                ...notification,
                title: "It's a Match! 🎉",
                type: 'MATCH',
                entityId: match.id,
                actionUrl: `/messages/${match.id}`,
                isRead: false,
              })),
              skipDuplicates: true,
            });
          return {
            response: {
              matched: true as const,
              matchId: match.id,
              matchedUser: {
                id: targetUserId,
                name: target.profile.name,
                photo: targetPhoto?.url ?? null,
              },
              currentUser: {
                id: userId,
                name: currentProfile?.name ?? '',
                photo: currentPhoto?.url ?? null,
              },
            },
            notify: notifications.map(({ userId }) => ({ userId, matchId: match.id })),
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        attempt >= 4 ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !['P2034', 'P2002'].includes(error.code)
      )
        throw error;
      await delay(10 * (attempt + 1));
    }
  }
}
