'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { useRealtime } from '@/app/components/providers/realtime-provider';
import { readPresence } from '@/lib/client/presence';
import { FetchError } from '@/lib/fetch-wrapper';
import type { PresenceStatus, PresenceSnapshot } from './presence-input';

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
  const { status } = useRealtime();
  const viewerId = session?.user.id;
  const sessionId = session?.session.id;
  const client = useQueryClient();
  const visible = useSyncExternalStore(
    visibilityChanged,
    () => document.visibilityState === 'visible',
    () => false,
  );
  const snapshot = useQuery<PresenceSnapshot>({
    queryKey: ['online-status', viewerId, sessionId, userId],
    enabled: enabled && !!viewerId && !!sessionId && status === 'connected' && visible,
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
    if (!snapshot.dataUpdatedAt) return;
    const updatedAt = snapshot.dataUpdatedAt;
    // Repeated hints can cancel reads before their request timeout. Cap the
    // displayed snapshot age independently so cancellation cannot retain online.
    const timer = setTimeout(
      () => setExpiredSnapshot(updatedAt),
      Math.max(0, updatedAt + 20_000 - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [snapshot.dataUpdatedAt]);
  const expired = snapshot.dataUpdatedAt > 0 && expiredSnapshot >= snapshot.dataUpdatedAt;
  useEffect(() => {
    if (!enabled || !viewerId || !sessionId) return;
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
  }, [enabled, viewerId, sessionId, userId, client]);
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
