import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { auth } from '@/lib/auth';
import { getCookies } from 'better-auth/cookies';
import { attachMessageHandlers, attachMessageDelivery } from '@/lib/server/message-delivery';
import { attachSocketSessionGuard } from '@/lib/server/socket-session';
import { attachLiveMatchHandlers } from '@/lib/server/socket-live-match';
import { attachPresenceHandlers } from '@/lib/server/presence';
import { setSocketInstance } from '@/lib/socket-instance';
import { socketEnvironment } from '@/lib/server/env';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@/lib/socket';

const { port, clientOrigin } = socketEnvironment();

const httpServer = createServer();

const io = new SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(httpServer, {
  cors: {
    origin: clientOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

setSocketInstance(io);
attachMessageDelivery(io, httpServer);

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

  attachMessageHandlers(io, socket);

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
