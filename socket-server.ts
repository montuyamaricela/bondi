import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { auth } from '@/lib/auth';
import { getCookies } from 'better-auth/cookies';
import { db } from '@/lib/db';
import { writeMessage, messageWriteError } from '@/lib/server/messages';
import { attachSocketSessionGuard } from '@/lib/server/socket-session';
import { attachLiveMatchHandlers } from '@/lib/server/socket-live-match';
import { attachPresenceHandlers } from '@/lib/server/presence';
import { setSocketInstance } from '@/lib/socket-instance';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@/lib/socket';

const port = parseInt(process.env.SOCKET_PORT || '3001', 10);
const clientUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const httpServer = createServer();

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: clientUrl,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setSocketInstance(io);

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

httpServer
  .once('error', (err) => {
    console.error(err);
    process.exit(1);
  })
  .listen(port, () => {
    console.log(`> Socket.IO server listening on port ${port}`);
  });
