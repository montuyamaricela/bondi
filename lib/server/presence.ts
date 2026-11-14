import { z } from 'zod';
import type { Socket } from 'socket.io';
import { db } from '@/lib/db';
import { getAuthorizedUserSockets } from './socket-session';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  SocketServer,
  PresenceSnapshot,
} from '@/lib/socket';

type PresenceSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type RefreshQueues = WeakMap<SocketServer, Map<string, Promise<void>>>;
// Route bundles and the socket owner must serialize refreshes through the same queue.
const runtime = globalThis as typeof globalThis & { bondiPresenceRefreshes?: RefreshQueues };
const queues = (runtime.bondiPresenceRefreshes ??= new WeakMap());
const requestSchema = z.object({
  userIds: z.array(z.string().min(1).max(128)).max(100),
  refreshOwn: z.boolean().optional(),
});

async function activePeers(userId: string, requested?: string[]) {
  const matches = await db.match.findMany({
    where: {
      status: 'ACTIVE',
      OR: [
        { user1Id: userId, ...(requested ? { user2Id: { in: requested } } : {}) },
        { user2Id: userId, ...(requested ? { user1Id: { in: requested } } : {}) },
      ],
    },
    select: { user1Id: true, user2Id: true },
  });
  return matches.map((match) => (match.user1Id === userId ? match.user2Id : match.user1Id));
}

export async function getPresence(
  io: SocketServer | null,
  viewerId: string,
  requested: string[],
): Promise<PresenceSnapshot> {
  const result: PresenceSnapshot = Object.fromEntries(
    requested.map((id) => [id, { visible: false, online: false }]),
  );
  if (!requested.length) return result;
  const peers = await activePeers(viewerId, requested);
  const [profiles, connected] = await Promise.all([
    db.profile.findMany({
      where: { userId: { in: peers }, showOnlineStatus: true },
      select: { userId: true },
    }),
    getAuthorizedUserSockets(io, peers),
  ]);
  const online = new Set(connected.map((socket) => socket.data.userId));
  for (const profile of profiles)
    result[profile.userId] = { visible: true, online: online.has(profile.userId) };
  return result;
}

export async function refreshPresence(io: SocketServer | null, userId: string) {
  if (!io) return;
  let pendingByUser = queues.get(io);
  if (!pendingByUser) {
    pendingByUser = new Map();
    queues.set(io, pendingByUser);
  }
  const pending = (pendingByUser.get(userId) ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const [profile, connected, peers] = await Promise.all([
        db.profile.findUnique({ where: { userId }, select: { showOnlineStatus: true } }),
        getAuthorizedUserSockets(io, [userId]),
        activePeers(userId),
      ]);
      const recipients = await getAuthorizedUserSockets(io, peers);
      if (!recipients.length) return;
      const visible = profile?.showOnlineStatus === true;
      io.to(recipients.map((socket) => socket.id)).emit('presence:updated', {
        userId,
        visible,
        online: visible && connected.length > 0,
      });
    });
  pendingByUser.set(userId, pending);
  try {
    await pending;
  } finally {
    if (pendingByUser.get(userId) === pending) pendingByUser.delete(userId);
  }
}

export function attachPresenceHandlers(io: SocketServer, socket: PresenceSocket) {
  const refresh = () =>
    refreshPresence(io, socket.data.userId).catch(() => {
      console.error('Could not refresh online status');
    });
  socket.on('presence:sync', async (payload, acknowledge) => {
    if (typeof acknowledge !== 'function') return;
    const parsed = requestSchema.safeParse(payload);
    if (!parsed.success) {
      acknowledge({ ok: false, message: 'Invalid presence request' });
      return;
    }
    try {
      if (parsed.data.refreshOwn) await refreshPresence(io, socket.data.userId);
      const statuses = await getPresence(io, socket.data.userId, parsed.data.userIds);
      if (socket.connected) acknowledge({ ok: true, statuses });
    } catch {
      acknowledge({ ok: false, message: 'Online status is unavailable' });
    }
  });
  socket.on('disconnect', () => {
    void refresh();
  });
  void refresh();
}
