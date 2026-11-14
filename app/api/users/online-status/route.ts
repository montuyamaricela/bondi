import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { handleApiError } from '@/lib/errors';
import { getSocketInstance } from '@/lib/socket-instance';

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userIds } = body;

    if (
      !Array.isArray(userIds) ||
      userIds.length > 100 ||
      userIds.some((id) => typeof id !== 'string' || !id || id.length > 128)
    ) {
      return NextResponse.json(
        { error: 'userIds must contain at most 100 valid IDs' },
        { status: 400 },
      );
    }

    const matches = await db.match.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { user1Id: session.user.id, user2Id: { in: userIds } },
          { user2Id: session.user.id, user1Id: { in: userIds } },
        ],
      },
      select: { user1Id: true, user2Id: true },
    });
    const allowedIds = matches.map((match) =>
      match.user1Id === session.user.id ? match.user2Id : match.user1Id,
    );

    const profiles = await db.profile.findMany({
      where: {
        userId: { in: allowedIds },
      },
      select: {
        userId: true,
        showOnlineStatus: true,
      },
    });

    const usersWithPublicStatus = new Set(
      profiles.filter((p) => p.showOnlineStatus).map((p) => p.userId),
    );

    const io = getSocketInstance();
    const onlineUsers: Record<string, boolean> = {};

    if (io) {
      const sockets = await io.fetchSockets();
      const onlineUserIds = new Set(sockets.map((socket) => socket.data.userId));

      userIds.forEach((userId) => {
        onlineUsers[userId] = usersWithPublicStatus.has(userId) && onlineUserIds.has(userId);
      });
    } else {
      userIds.forEach((userId) => {
        onlineUsers[userId] = false;
      });
    }

    return NextResponse.json(onlineUsers);
  } catch (error) {
    return handleApiError(error);
  }
}
