import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { io as connectSocket, type Socket } from 'socket.io-client';
import { expect, test } from '@playwright/test';
import { auth } from '../../lib/auth';
import {
  initializeSocket,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '../../lib/socket';

import { connect, joinRooms } from './socket-helpers';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.18' } });

test('connected sockets in all three runtimes reject revoked and expired sessions', async ({
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const httpServer = createServer();
  const initializer = initializeSocket(httpServer);
  const clients: Client[] = [];
  const emails: string[] = [];
  const password = 'SyntheticSocketPassword42!';
  try {
    await new Promise<void>((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', resolve);
    });
    const address = httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Expected a TCP test address');
    const runtimes = [baseURL!, 'http://127.0.0.1:3101', `http://127.0.0.1:${address.port}`];
    for (const [runtimeIndex, url] of runtimes.entries()) {
      const requestHeaders = (ip: number) =>
        new Headers({ Origin: baseURL!, 'x-forwarded-for': `192.0.2.${ip}` });
      const cookieHeader = (headers: Headers) =>
        headers
          .getSetCookie()
          .map((value) => value.split(';', 1)[0])
          .join('; ');
      const people = [];
      for (const name of ['Alice', 'Bob']) {
        const email = `bondi-e2e-${randomUUID()}-socket-${name.toLowerCase()}@example.test`;
        emails.push(email);
        const registered = await auth.api.signUpEmail({
          body: { email, password, name: `Synthetic Socket ${name}` },
          headers: requestHeaders(18 + runtimeIndex),
          returnHeaders: true,
        });
        const userId = registered.response.user.id;
        await db.profile.create({
          data: {
            userId,
            name: `Synthetic Socket ${name}`,
            age: 28,
            bio: 'A synthetic account for socket authorization checks.',
            gender: 'OTHER',
            interests: ['Music'],
            hobbies: ['Reading'],
            showOnlineStatus: false,
          },
        });
        people.push({ userId, email, cookie: cookieHeader(registered.headers) });
      }
      const [alice, bob] = people;
      const match = await db.match.create({ data: { user1Id: alice.userId, user2Id: bob.userId } });
      const unread = await db.message.create({
        data: {
          matchId: match.id,
          senderId: bob.userId,
          type: 'TEXT',
          content: 'Synthetic unread message',
        },
      });
      async function open(cookie: string) {
        const response = await request.get('/api/socket/token', { headers: { Cookie: cookie } });
        expect(response.status()).toBe(200);
        const { token } = await response.json();
        expect(typeof token).toBe('string');
        const client: Client = connectSocket(url, {
          auth: { token },
          autoConnect: false,
          reconnection: false,
          transports: ['websocket'],
          extraHeaders: { Origin: baseURL! },
        });
        clients.push(client);
        await connect(client);
        return client;
      }
      const peer = await open(bob.cookie);
      let forwardedTyping = 0;
      let delivered = 0;
      peer.on('typing:start', ({ userId }) => {
        if (userId === alice.userId) forwardedTyping++;
      });
      peer.on('typing:stop', ({ userId }) => {
        if (userId === alice.userId) forwardedTyping++;
      });
      peer.on('message:new', ({ matchId }) => {
        if (matchId === match.id) delivered++;
      });
      const allowed = await open(alice.cookie);
      await joinRooms(allowed, peer, match.id);
      allowed.emit('message:send', {
        matchId: match.id,
        content: 'An authorized synthetic message',
      });
      await expect.poll(() => delivered).toBe(1);
      await expect
        .poll(() => db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }))
        .toBe(1);
      allowed.emit('message:read', { messageId: unread.id });
      await expect
        .poll(
          async () =>
            (await db.message.findUniqueOrThrow({ where: { id: unread.id } })).readAt !== null,
        )
        .toBe(true);
      await db.message.update({ where: { id: unread.id }, data: { readAt: null } });
      allowed.disconnect();
      const saved = await db.message.count({ where: { matchId: match.id } });
      const actions: Array<(client: Client) => void> = [
        (client) => {
          client.emit('message:send', { matchId: match.id, content: 'This must not be saved' });
        },
        (client) => {
          client.emit('message:read', { messageId: unread.id });
        },
        (client) => {
          client.emit('match:join', { matchId: match.id });
        },
        (client) => {
          client.emit('match:leave', { matchId: match.id });
        },
        (client) => {
          client.emit('typing:start', { matchId: match.id });
        },
        (client) => {
          client.emit('typing:stop', { matchId: match.id });
        },
      ];
      for (const [actionIndex, action] of actions.entries()) {
        for (const [modeIndex, mode] of ['revoked', 'expired'].entries()) {
          await db.session.deleteMany({ where: { userId: alice.userId } });
          const signedIn = await auth.api.signInEmail({
            body: { email: alice.email, password },
            headers: requestHeaders(30 + runtimeIndex * 30 + actionIndex * 2 + modeIndex),
            returnHeaders: true,
          });
          const client = await open(cookieHeader(signedIn.headers));
          await joinRooms(client, peer, match.id);
          let unauthorized = false;
          client.onAny((event, payload: unknown) => {
            if (
              event === 'auth:error' &&
              payload &&
              typeof payload === 'object' &&
              'code' in payload &&
              payload.code === 'UNAUTHORIZED'
            )
              unauthorized = true;
          });
          const typingBefore = forwardedTyping;
          if (mode === 'revoked') {
            expect((await db.session.deleteMany({ where: { userId: alice.userId } })).count).toBe(
              1,
            );
          } else {
            expect(
              (
                await db.session.updateMany({
                  where: { userId: alice.userId },
                  data: { expiresAt: new Date(Date.now() - 60_000) },
                })
              ).count,
            ).toBe(1);
          }
          action(client);
          await expect
            .poll(
              async () => {
                if ((await db.message.count({ where: { matchId: match.id } })) > saved)
                  return 'saved';
                if (unauthorized && !client.connected) return 'rejected';
                return 'waiting';
              },
              { message: `runtime ${runtimeIndex}, ${mode}, action ${actionIndex} must reject` },
            )
            .toBe('rejected');
          expect(await db.message.count({ where: { matchId: match.id } })).toBe(saved);
          expect((await db.message.findUniqueOrThrow({ where: { id: unread.id } })).readAt).toBe(
            null,
          );
          expect(forwardedTyping).toBe(typingBefore);
          client.disconnect();
        }
      }
      peer.disconnect();
    }
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise<void>((resolve) => {
      initializer.close(() => resolve());
    });
    try {
      await db.match.deleteMany({
        where: { OR: [{ user1: { email: { in: emails } } }, { user2: { email: { in: emails } } }] },
      });
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});
