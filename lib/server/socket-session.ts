import type { Socket } from 'socket.io';
import { db } from '@/lib/db';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketServer,
} from '@/lib/socket';

type SessionSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function attachSocketSessionGuard(socket: SessionSocket) {
  // Keep authorization completions in packet order, including while queries are pending.
  let pending = Promise.resolve();
  socket.use((_packet, next) => {
    pending = pending.then(async () => {
      if (!socket.connected) return;
      try {
        const session = await db.session.findUnique({
          where: { id: socket.data.sessionId },
          select: { userId: true, expiresAt: true },
        });
        if (!socket.connected) return;
        if (session?.userId === socket.data.userId && session.expiresAt.getTime() > Date.now()) {
          next();
          return;
        }
      } catch {
        // A failed authoritative lookup must not allow a protected action.
      }
      if (!socket.connected) return;
      socket.emit('auth:error', {
        code: 'UNAUTHORIZED',
        message: 'Your session could not be verified. Refresh or sign in again.',
      });
      socket.disconnect(true);
    });
  });
}

export async function getAuthorizedUserSockets(io: SocketServer | null, userIds?: string[]) {
  if (!io || (userIds && !userIds.length)) return [];
  const sockets = await (userIds ? io.in(userIds.map((id) => `user:${id}`)) : io).fetchSockets();
  if (!sockets.length) return [];
  const sessions = await db.session.findMany({
    where: {
      id: { in: sockets.map((socket) => socket.data.sessionId) },
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });
  const valid = new Map(sessions.map((session) => [session.id, session.userId]));
  return sockets.filter((socket) => valid.get(socket.data.sessionId) === socket.data.userId);
}
