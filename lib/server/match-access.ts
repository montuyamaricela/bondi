import { db } from '@/lib/db';
import { createAppError } from '@/lib/app-error';

const selection = { id: true, user1Id: true, user2Id: true, status: true } as const;

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
