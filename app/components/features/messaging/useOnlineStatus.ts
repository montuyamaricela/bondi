'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/app/components/providers/socket-provider';
import type { PresenceStatus, ServerToClientEvents } from '@/lib/socket';
import { useSession } from '@/lib/auth-client';
import { useRealtime } from '@/app/components/providers/realtime-provider';
import { readPresence } from '@/lib/client/presence';
import { FetchError } from '@/lib/fetch-wrapper';
import type { PresenceSnapshot } from './presence-input';

const invisible: PresenceStatus = { visible: false, online: false };

function visibilityChanged(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

export function useOnlineStatus(
  userId: string,
  enabled = true,
): PresenceStatus & { unavailable?: boolean; retry?: () => void } {
  const { data: session } = useSession();
  const { enabled: native, status } = useRealtime();
  const viewerId = session?.user.id;
  const sessionId = session?.session.id;
  const client = useQueryClient();
  const visible = useSyncExternalStore(
    visibilityChanged,
    () => document.visibilityState === 'visible',
    () => false,
  );
  const legacy = useLegacyOnlineStatus(userId, enabled && !native);
  const snapshot = useQuery<PresenceSnapshot>({
    queryKey: ['online-status', viewerId, sessionId, userId],
    enabled: native && enabled && !!viewerId && !!sessionId && status === 'connected' && visible,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      query.state.error instanceof FetchError &&
      [400, 401, 403, 409].includes(query.state.error.status)
        ? false
        : 15_000,
    refetchOnWindowFocus: 'always',
    queryFn: ({ signal }) => {
      if (!viewerId || !sessionId) throw new Error('Session changed');
      return readPresence({ userId: viewerId, sessionId }, [userId], signal);
    },
  });
  const [expiredSnapshot, setExpiredSnapshot] = useState(0);
  useEffect(() => {
    if (!native || !snapshot.dataUpdatedAt) return;
    const updatedAt = snapshot.dataUpdatedAt;
    // Repeated hints can cancel reads before their request timeout. Cap the
    // displayed snapshot age independently so cancellation cannot retain online.
    const timer = setTimeout(
      () => setExpiredSnapshot(updatedAt),
      Math.max(0, updatedAt + 20_000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [native, snapshot.dataUpdatedAt]);
  const expired = snapshot.dataUpdatedAt > 0 && expiredSnapshot >= snapshot.dataUpdatedAt;
  useEffect(() => {
    if (!native || !enabled || !viewerId || !sessionId) return;
    const filter = { queryKey: ['online-status', viewerId, sessionId, userId], exact: true };
    const refresh = () => {
      void client.cancelQueries(filter).then(() => client.resetQueries(filter));
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [native, enabled, viewerId, sessionId, userId, client]);
  if (!native) return legacy;
  if (!enabled || !visible || status !== 'connected' || snapshot.isError || expired)
    return {
      ...invisible,
      unavailable: enabled && (snapshot.isError || expired),
      retry: () => {
        void snapshot.refetch();
      },
    };
  return snapshot.data?.[userId] ?? invisible;
}

function useLegacyOnlineStatus(userId: string, enabled: boolean): PresenceStatus {
  const { socket, isConnected } = useSocket();
  const [state, setState] = useState<{
    userId: string;
    connectionId: string | undefined;
    status: PresenceStatus;
  }>({ userId: '', connectionId: undefined, status: invisible });

  useEffect(() => {
    if (!socket || !isConnected || !enabled) return;
    let active = true;
    let revision = 0;
    const connectionId = socket.id;
    const handleUpdate: ServerToClientEvents['presence:updated'] = (update) => {
      if (update.userId !== userId) return;
      revision++;
      setState({
        userId,
        connectionId,
        status: { visible: update.visible, online: update.online },
      });
    };
    socket.on('presence:updated', handleUpdate);
    const snapshotRevision = revision;
    void socket
      .timeout(5000)
      .emitWithAck('presence:sync', { userIds: [userId] })
      .then((result) => {
        if (active && revision === snapshotRevision) {
          setState({
            userId,
            connectionId,
            status: result.ok ? (result.statuses[userId] ?? invisible) : invisible,
          });
        }
      })
      .catch(() => {
        if (active && revision === snapshotRevision)
          setState({ userId, connectionId, status: invisible });
      });
    return () => {
      active = false;
      socket.off('presence:updated', handleUpdate);
    };
  }, [socket, isConnected, userId, enabled]);

  return enabled && isConnected && state.userId === userId && state.connectionId === socket?.id
    ? state.status
    : invisible;
}
