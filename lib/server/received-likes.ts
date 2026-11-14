import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { nextCursor, type Pagination } from './cursor-pagination';
import { locationSelect } from './location';
import { publicLocation } from '@/lib/location';

export function receivedLikesQuery(userId: string, { limit, cursor }: Pagination) {
  const before = cursor
    ? Prisma.sql`AND (l."createdAt", l."id") < (${cursor.at}::timestamp, ${cursor.id})`
    : Prisma.empty;
  return Prisma.sql`SELECT l."id", l."createdAt" FROM "Like" l
    WHERE l."targetUserId" = ${userId} AND l."action" = 'LIKE'
    AND NOT EXISTS (
      SELECT 1 FROM "Like" handled WHERE handled."userId" = ${userId}
      AND handled."targetUserId" = l."userId"
    )
    AND NOT EXISTS (
      SELECT 1 FROM "Match" m WHERE m."status" = 'ACTIVE' AND
      ((m."user1Id" = ${userId} AND m."user2Id" = l."userId") OR
       (m."user2Id" = ${userId} AND m."user1Id" = l."userId"))
    ) ${before} ORDER BY l."createdAt" DESC, l."id" DESC LIMIT ${limit + 1}`;
}

export async function readReceivedLikes(userId: string, pagination: Pagination) {
  const rows = await db.$queryRaw<Array<{ id: string; createdAt: Date }>>(
    receivedLikesQuery(userId, pagination),
  );
  const selected = rows.slice(0, pagination.limit);
  const likes = await db.like.findMany({
    where: { id: { in: selected.map((row) => row.id) }, targetUserId: userId, action: 'LIKE' },
    include: {
      user: {
        select: {
          profile: {
            select: {
              id: true,
              name: true,
              age: true,
              bio: true,
              gender: true,
              ...locationSelect,
              interests: true,
              hobbies: true,
              lookingFor: true,
              relationshipType: true,
            },
          },
          files: { orderBy: [{ order: 'asc' }, { id: 'asc' }] },
        },
      },
    },
  });
  const byId = new Map(
    likes.map((like) => [
      like.id,
      {
        id: like.user.profile?.id,
        userId: like.userId,
        name: like.user.profile?.name || 'Unknown',
        age: like.user.profile?.age,
        bio: like.user.profile?.bio,
        gender: like.user.profile?.gender,
        ...(like.user.profile ? publicLocation(like.user.profile) : {}),
        interests: like.user.profile?.interests || [],
        hobbies: like.user.profile?.hobbies || [],
        lookingFor: like.user.profile?.lookingFor,
        relationshipType: like.user.profile?.relationshipType,
        photos: like.user.files.map((file) => ({ id: file.id, url: file.url, key: file.key })),
        likedAt: like.createdAt,
      },
    ]),
  );
  const items = selected.flatMap((row) => {
    const item = byId.get(row.id);
    return item ? [item] : [];
  });
  const last = selected.at(-1);
  return {
    items,
    nextCursor:
      rows.length > pagination.limit && last
        ? nextCursor('likes', userId, { id: last.id, at: last.createdAt })
        : null,
  };
}
