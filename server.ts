import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { auth } from '@/lib/auth';
import { getCookies } from 'better-auth/cookies';
import { attachMessageHandlers, attachMessageDelivery } from '@/lib/server/message-delivery';
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

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

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
      console.log(
        `> Next.js server with Socket.IO listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`,
      );
    });
});
