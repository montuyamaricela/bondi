import type { Socket } from 'socket.io';
import { db } from '@/lib/db';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
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
