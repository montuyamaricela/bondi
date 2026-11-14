import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { messageSelection } from './messages';
import { nextCursor, type Pagination } from './cursor-pagination';

export function messageHistoryQuery(matchId: string, { limit, cursor }: Pagination) {
  // The stored columns are timestamp without time zone; bind UTC text with that same type.
  const before = cursor
    ? Prisma.sql`AND ("createdAt", "id") < (${cursor.at}::timestamp, ${cursor.id})`
    : Prisma.empty;
  return Prisma.sql`SELECT "id", "createdAt" FROM "Message" WHERE "matchId" = ${matchId} ${before} ORDER BY "createdAt" DESC, "id" DESC LIMIT ${limit + 1}`;
}

export async function readMessageHistory(userId: string, matchId: string, pagination: Pagination) {
  const rows = await db.$queryRaw<Array<{ id: string; createdAt: Date }>>(
    messageHistoryQuery(matchId, pagination),
  );
  const selected = rows.slice(0, pagination.limit);
  const items = await db.message.findMany({
    where: { id: { in: selected.map((row) => row.id) }, matchId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: messageSelection,
  });
  const last = selected.at(-1);
  return {
    items,
    nextCursor:
      rows.length > pagination.limit && last
        ? nextCursor('messages', userId, { id: last.id, at: last.createdAt }, matchId)
        : null,
  };
}
