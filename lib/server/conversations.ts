import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { nextCursor, type Pagination } from './cursor-pagination';

export function conversationPageQuery(userId: string, { limit, cursor }: Pagination, search = '') {
  const before = cursor
    ? Prisma.sql`WHERE ("at", "id") < (${cursor.at}::timestamp, ${cursor.id})`
    : Prisma.empty;
  const nameFilter = search
    ? Prisma.sql`AND EXISTS (
    SELECT 1 FROM "User" u LEFT JOIN "Profile" p ON p."userId" = u."id"
    WHERE u."id" = CASE WHEN m."user1Id" = ${userId} THEN m."user2Id" ELSE m."user1Id" END
    AND strpos(lower(COALESCE(NULLIF(p."name", ''), NULLIF(u."name", ''), 'Unknown')), lower(${search})) > 0
  )`
    : Prisma.empty;
  return Prisma.sql`WITH activity AS (
    SELECT m."id", COALESCE(latest."createdAt", m."matchedAt") AS "at"
    FROM "Match" m
    LEFT JOIN LATERAL (
      SELECT "createdAt" FROM "Message" WHERE "matchId" = m."id"
      ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
    ) latest ON true
    WHERE (m."user1Id" = ${userId} OR m."user2Id" = ${userId}) ${nameFilter}
  ) SELECT "id", "at" FROM activity ${before} ORDER BY "at" DESC, "id" DESC LIMIT ${limit + 1}`;
}

export async function readConversations(userId: string, pagination: Pagination, search = '') {
  const rows = await db.$queryRaw<Array<{ id: string; at: Date }>>(
    conversationPageQuery(userId, pagination, search),
  );
  const selected = rows.slice(0, pagination.limit);
  const matches = await db.match.findMany({
    where: {
      id: { in: selected.map((row) => row.id) },
      OR: [{ user1Id: userId }, { user2Id: userId }],
    },
    include: {
      user1: {
        select: {
          id: true,
          name: true,
          image: true,
          profile: {
            select: {
              name: true,
              age: true,
              showOnlineStatus: true,
            },
          },
          files: {
            take: 1,
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: {
              url: true,
            },
          },
        },
      },
      user2: {
        select: {
          id: true,
          name: true,
          image: true,
          profile: {
            select: {
              name: true,
              age: true,
              showOnlineStatus: true,
            },
          },
          files: {
            take: 1,
            orderBy: [{ order: 'asc' }, { id: 'asc' }],
            select: {
              url: true,
            },
          },
        },
      },
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: {
          id: true,
          content: true,
          senderId: true,
          createdAt: true,
          readAt: true,
        },
      },
      _count: {
        select: {
          messages: {
            where: {
              readAt: null,
              senderId: { not: userId },
            },
          },
        },
      },
    },
  });

  const conversations = matches.map((match) => {
    const otherUser = match.user1Id === userId ? match.user2 : match.user1;
    const lastMessage = match.messages[0] || null;

    const unreadCount = match._count.messages;

    return {
      matchId: match.id,
      matchedAt: match.matchedAt,
      status: match.status,
      otherUser: {
        id: otherUser.id,
        userId: otherUser.id,
        name: otherUser.profile?.name || otherUser.name || 'Unknown',
        age: otherUser.profile?.age || null,
        image: otherUser.files[0]?.url || otherUser.image || null,
        showOnlineStatus: otherUser.profile?.showOnlineStatus ?? true,
      },
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.senderId,
            createdAt: lastMessage.createdAt,
            readAt: lastMessage.readAt,
          }
        : null,
      unreadCount,
    };
  });

  const byId = new Map(conversations.map((conversation) => [conversation.matchId, conversation]));
  const items = selected.flatMap((row) => {
    const conversation = byId.get(row.id);
    return conversation ? [conversation] : [];
  });
  const last = selected.at(-1);
  return {
    items,
    nextCursor:
      rows.length > pagination.limit && last
        ? nextCursor('conversations', userId, last, search || undefined)
        : null,
  };
}
