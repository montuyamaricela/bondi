import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { auth } from '@/lib/auth';
import { getCookies } from 'better-auth/cookies';
import { db } from '@/lib/db';
import { writeMessage, messageWriteError } from '@/lib/server/messages';
import { attachSocketSessionGuard } from '@/lib/server/socket-session';
import { attachLiveMatchHandlers } from '@/lib/server/socket-live-match';
import { attachPresenceHandlers } from '@/lib/server/presence';

export type PresenceStatus = { visible: boolean; online: boolean };
export type PresenceSnapshot = Record<string, PresenceStatus>;

export type ServerToClientEvents = {
  'auth:error': (error: { code: 'UNAUTHORIZED'; message: string }) => void;
  'match:error': (error: { code: 'LIVE_ACCESS_DENIED'; message: string }) => void;
  'match:updated': (data: { matchId: string; status: 'UNMATCHED' }) => void;
  'message:error': (error: { code: string; message: string }) => void;
  'message:new': (message: {
    id: string;
    matchId: string;
    senderId: string;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'FILE';
    fileUrl?: string | null;
    fileKey?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    fileType?: string | null;
    createdAt: string;
    readAt?: string | null;
  }) => void;
  'message:read': (data: { messageId: string; readAt: string }) => void;
  'typing:start': (data: { userId: string; matchId: string }) => void;
  'typing:stop': (data: { userId: string; matchId: string }) => void;
  'presence:updated': (data: PresenceStatus & { userId: string }) => void;
  'notification:new': (data: { type: string; matchId?: string }) => void;
};

export type ClientToServerEvents = {
  'presence:sync': (
    data: { userIds: string[]; refreshOwn?: boolean },
    acknowledge: (
      result: { ok: true; statuses: PresenceSnapshot } | { ok: false; message: string },
    ) => void,
  ) => void;
  'message:send': (
    data: {
      matchId: string;
      content: string;
      clientRequestId?: string;
      file?: {
        key: string;
        url?: string;
        name?: string;
        size?: number;
        type?: string;
      };
    },
    acknowledge: (result: MessageSendResult) => void,
  ) => void;
  'message:read': (data: { messageId: string }) => void;
  'typing:start': (data: { matchId: string }) => void;
  'typing:stop': (data: { matchId: string }) => void;
  'match:join': (data: { matchId: string }, acknowledge: (result: { ok: boolean }) => void) => void;
  'match:leave': (data: { matchId: string }) => void;
};

export type MessageSendResult =
  | { ok: true; message: Parameters<ServerToClientEvents['message:new']>[0] }
  | { ok: false; code: string; message: string };

export type InterServerEvents = Record<string, never>;

export type SocketData = {
  userId: string;
  sessionId: string;
};

export type SocketServer = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function initializeSocket(httpServer: NetServer): SocketServer {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (typeof token !== 'string' || !token || token.length > 4096) {
        return next(new Error('Authentication required'));
      }

      const cookieName = getCookies(auth.options).sessionToken.name;

      const session = await auth.api.getSession({
        query: { disableCookieCache: true },
        headers: {
          authorization: `Bearer ${token}`,
          cookie: `${cookieName}=${token}`,
        },
      });

      if (!session?.user) {
        return next(new Error('Invalid session'));
      }

      socket.data.userId = session.user.id;
      socket.data.sessionId = session.session.id;

      next();
    } catch {
      console.error('Socket authentication failed');
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    attachSocketSessionGuard(socket);
    const userId = socket.data.userId;

    console.log(`User connected: ${userId}`);

    socket.join(`user:${userId}`);

    attachLiveMatchHandlers(io, socket);

    socket.on('message:send', async (payload, acknowledge) => {
      let saved = false;
      try {
        const { message, receiverId, replayed } = await writeMessage(userId, payload);
        saved = true;
        const outgoing = {
          ...message,
          createdAt: message.createdAt.toISOString(),
          readAt: message.readAt?.toISOString() ?? null,
        };
        if (typeof acknowledge === 'function') acknowledge({ ok: true, message: outgoing });
        if (replayed) return;
        const { matchId, content } = message;

        io.to(`match:${matchId}`).emit('message:new', outgoing);

        const senderProfile = await db.profile.findUnique({
          where: { userId },
          select: { name: true },
        });

        const notificationContent =
          message.type === 'IMAGE'
            ? `${senderProfile?.name || 'Someone'} sent you an image`
            : message.type === 'FILE'
              ? `${senderProfile?.name || 'Someone'} sent you a file`
              : `${senderProfile?.name || 'Someone'} sent you a message: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`;

        await db.notification.create({
          data: {
            userId: receiverId,
            title: 'New Message',
            content: notificationContent,
            type: 'MESSAGE',
            entityId: matchId,
            actionUrl: `/messages/${matchId}`,
            isRead: false,
          },
        });

        io.to(`user:${receiverId}`).emit('notification:new', {
          type: 'MESSAGE',
          matchId,
        });

        console.log(`Message sent in match ${matchId} by user ${userId}`);
      } catch (error) {
        if (saved) {
          console.error('Message follow-up failed after persistence');
          return;
        }
        const { code, error: message } = messageWriteError(error);
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, code, message });
          return;
        }
        socket.emit('message:error', { code, message });
      }
    });

    attachPresenceHandlers(io, socket);
  });

  return io;
}
