import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';

const selection = { id: true, user1Id: true, user2Id: true, status: true } as const;

export async function activePeerIds(userId: string, requested?: string[]) {
  const matches = await db.match.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { user1Id: userId, ...(requested ? { user2Id: { in: requested } } : {}) },
        { user2Id: userId, ...(requested ? { user1Id: { in: requested } } : {}) },
      ],
    },
    select: { user1Id: true, user2Id: true },
  });
  return matches.map((match) => (match.user1Id === userId ? match.user2Id : match.user1Id));
}

export async function requireMatchMember(userId: string, matchId: unknown) {
  if (typeof matchId !== 'string' || !matchId || matchId.length > 128)
    throw createAppError('Invalid match ID', 400);
  const match = await db.match.findUnique({ where: { id: matchId }, select: selection });
  if (!match) throw createAppError('Match not found', 404);
  if (match.user1Id !== userId && match.user2Id !== userId)
    throw createAppError('Not authorized for this match', 403);
  return match;
}

export async function endMatch(userId: string, matchId: unknown) {
  const match = await requireMatchMember(userId, matchId);
  if (match.status === 'UNMATCHED') return match;
  return db.match.update({
    where: { id: match.id },
    data: { status: 'UNMATCHED' },
    select: selection,
  });
}
