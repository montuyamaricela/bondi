import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketServer,
} from '@/lib/socket';
import { db } from '@/lib/db';
import { getAuthorizedUserSockets } from './socket-session';
import { requireMatchMember } from './match-access';

type LiveSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type Match = Awaited<ReturnType<typeof requireMatchMember>>;

export function notifyMatchEnded(io: SocketServer | null, match: Match) {
  if (!io || match.status !== 'UNMATCHED') return;
  try {
    io.to([`user:${match.user1Id}`, `user:${match.user2Id}`]).emit('match:updated', {
      matchId: match.id,
      status: 'UNMATCHED',
    });
    io.in(`match:${match.id}`).socketsLeave(`match:${match.id}`);
    io.to(`user:${match.user1Id}`).emit('presence:updated', {
      userId: match.user2Id,
      visible: false,
      online: false,
    });
    io.to(`user:${match.user2Id}`).emit('presence:updated', {
      userId: match.user1Id,
      visible: false,
      online: false,
    });
  } catch {
    console.error('Could not refresh ended match connections');
  }
}

export function attachLiveMatchHandlers(io: SocketServer, socket: LiveSocket) {
  const userId = socket.data.userId;
  const denied = () =>
    socket.emit('match:error', {
      code: 'LIVE_ACCESS_DENIED',
      message: 'This match is not available for live communication.',
    });
  const activeMatch = async (matchId: unknown) => {
    const match = await requireMatchMember(userId, matchId);
    if (match.status !== 'ACTIVE') {
      notifyMatchEnded(io, match);
      return null;
    }
    return match;
  };

  socket.on('match:join', async (payload, acknowledge) => {
    let joined = false;
    try {
      const match = await activeMatch(payload?.matchId);
      if (match && socket.connected) {
        await socket.join(`match:${match.id}`);
        joined = true;
      }
    } catch {
      /* The acknowledgement denies invalid or unavailable membership. */
    }
    if (typeof acknowledge === 'function') acknowledge({ ok: joined });
  });
  socket.on('match:leave', async (payload) => {
    try {
      const match = await requireMatchMember(userId, payload?.matchId);
      await socket.leave(`match:${match.id}`);
      notifyMatchEnded(io, match);
    } catch {
      denied();
    }
  });
  socket.on('message:read', async (payload) => {
    try {
      const messageId = payload?.messageId;
      if (typeof messageId !== 'string' || !messageId || messageId.length > 128) {
        denied();
        return;
      }
      const message = await db.message.findUnique({
        where: { id: messageId },
        select: { id: true, matchId: true, senderId: true, readAt: true },
      });
      const match = message ? await activeMatch(message.matchId) : null;
      if (!message || !match) {
        denied();
        return;
      }
      if (message.senderId === userId || message.readAt) return;
      const readAt = new Date();
      const updated = await db.message.updateMany({
        where: {
          id: message.id,
          readAt: null,
          senderId: { not: userId },
          match: { status: 'ACTIVE', OR: [{ user1Id: userId }, { user2Id: userId }] },
        },
        data: { readAt },
      });
      if (updated.count) {
        const recipients = await getAuthorizedUserSockets(io, [match.user1Id, match.user2Id]);
        if (!recipients.length) return;
        const audience = io.to(recipients.map((recipient) => recipient.id));
        audience.emit('message:read', {
          messageId: message.id,
          readAt: readAt.toISOString(),
        });
        audience.emit('inbox:updated');
      }
    } catch {
      denied();
    }
  });
  for (const event of ['typing:start', 'typing:stop'] as const) {
    socket.on(event, async (payload) => {
      try {
        const match = await activeMatch(payload?.matchId);
        if (!match) {
          denied();
          return;
        }
        socket.to(`match:${match.id}`).emit(event, { userId, matchId: match.id });
      } catch {
        denied();
      }
    });
  }
}
