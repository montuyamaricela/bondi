import type { Server } from 'node:http';
import type { Socket } from 'socket.io';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { nativeRealtimeEnabled } from '@/lib/server/env';
import type {
  SocketServer,
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@/lib/socket';
import { getAuthorizedUserSockets } from './socket-session';
import { writeMessage, messageWriteError, messageSelection, serializeMessage } from './messages';

type Relay = { wake: () => void };
const runtime = globalThis as typeof globalThis & {
  bondiMessageRelays?: WeakMap<SocketServer, Relay>;
};
const relays = (runtime.bondiMessageRelays ??= new WeakMap());

export function wakeMessageDelivery(io: SocketServer | null) {
  if (io) relays.get(io)?.wake();
}

export function attachMessageDelivery(io: SocketServer, server: Server) {
  if (nativeRealtimeEnabled()) return;
  if (relays.has(io)) return;
  let stopped = false;
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  const flush = async () => {
    const sockets = await getAuthorizedUserSockets(io);
    if (stopped || !sockets.length) return;
    const users = [...new Set(sockets.map((socket) => socket.data.userId))];
    await db.$transaction(async (transaction) => {
      // Claims stay short: database work and synchronous enqueueing, never network waits.
      const claims = await transaction.$queryRaw<Array<{ messageId: string; userId: string }>>`
        SELECT "messageId", "userId" FROM "MessageDelivery"
        WHERE "completedAt" IS NULL AND "userId" IN (${Prisma.join(users)})
        ORDER BY "createdAt", "messageId", "userId" LIMIT 100 FOR UPDATE SKIP LOCKED`;
      if (!claims.length || stopped) return;
      const deliveries = await transaction.messageDelivery.findMany({
        where: { OR: claims },
        include: {
          message: {
            select: {
              ...messageSelection,
              match: { select: { status: true, user1Id: true, user2Id: true } },
            },
          },
          notification: { select: { id: true, isRead: true } },
        },
      });
      const inboxes = new Set<string>();
      const notifications = new Map<string, { notificationId: string; matchId: string }>();
      for (const delivery of deliveries) {
        if (stopped) return;
        const { match, ...message } = delivery.message;
        const members = [match.user1Id, match.user2Id];
        if (
          match.status === 'ACTIVE' &&
          members.includes(delivery.userId) &&
          members.includes(message.senderId)
        ) {
          const recipients = sockets.filter((socket) => socket.data.userId === delivery.userId);
          const targets = recipients.filter((socket) => socket.id !== delivery.excludedSocketId);
          if (targets.length)
            io.to(targets.map((socket) => socket.id)).emit(
              'message:new',
              serializeMessage(message),
            );
          inboxes.add(delivery.userId);
          if (delivery.notification && !delivery.notification.isRead)
            notifications.set(delivery.userId, {
              notificationId: delivery.notification.id,
              matchId: message.matchId,
            });
        }
      }
      for (const userId of inboxes) {
        if (stopped) return;
        const ids = sockets
          .filter((socket) => socket.data.userId === userId)
          .map((socket) => socket.id);
        io.to(ids).emit('inbox:updated');
        const notification = notifications.get(userId);
        if (notification) io.to(ids).emit('notification:new', { type: 'MESSAGE', ...notification });
      }
      if (!stopped)
        await transaction.messageDelivery.updateMany({
          where: { OR: claims },
          data: { completedAt: new Date() },
        });
    });
  };
  const wake = () => {
    if (stopped) return;
    if (running) {
      again = true;
      return;
    }
    running = true;
    void (async () => {
      do {
        again = false;
        try {
          await flush();
        } catch {
          console.error('Message delivery will retry');
        }
      } while (again);
    })().finally(() => {
      running = false;
    });
  };
  relays.set(io, { wake });
  const start = () => {
    timer = setInterval(wake, 1000);
    timer.unref();
    wake();
  };
  if (server.listening) start();
  else server.once('listening', start);
  server.once('close', () => {
    stopped = true;
    if (timer) clearInterval(timer);
    server.off('listening', start);
    relays.delete(io);
  });
}

export function attachMessageHandlers(
  io: SocketServer,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
) {
  socket.on('message:send', async (payload, acknowledge) => {
    let saved = false;
    try {
      const { message } = await writeMessage(socket.data.userId, payload, socket.id);
      saved = true;
      const outgoing = serializeMessage(message);
      if (typeof acknowledge === 'function') acknowledge({ ok: true, message: outgoing });
      else socket.emit('message:new', outgoing);
      wakeMessageDelivery(io);
    } catch (error) {
      if (saved) {
        console.error('Message follow-up failed after persistence');
        return;
      }
      const { code, error: message } = messageWriteError(error);
      if (typeof acknowledge === 'function') acknowledge({ ok: false, code, message });
      else socket.emit('message:error', { code, message });
    }
  });
}
