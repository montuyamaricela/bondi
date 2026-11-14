'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { browserRealtimeConfiguration } from '@/lib/client/env';
import { subscribeRealtime, type RealtimeConnectionState } from '@/lib/client/realtime';
import { refreshRealtimeMessages } from '@/lib/client/realtime-queries';
import { maintainPresence } from '@/lib/client/presence';
import { Button } from '@/app/components/ui/button';

const RealtimeContext = createContext<
  RealtimeConnectionState & { enabled: boolean; retry: () => void }
>({
  enabled: false,
  status: 'connecting',
  leaseId: null,
  retry: () => {},
});
export function useRealtime() {
  return useContext(RealtimeContext);
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  const queryClient = useQueryClient();
  const enabled = browserRealtimeConfiguration() !== null;
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  const [connection, setConnection] = useState<
    (RealtimeConnectionState & { userId: string; sessionId: string; revision: number }) | null
  >(null);
  useEffect(() => {
    const configuration = browserRealtimeConfiguration();
    if (!configuration || !userId || !sessionId) return;
    let active = true;
    const controller = new AbortController();
    const dispose = subscribeRealtime(
      { userId, sessionId },
      configuration,
      () => {
        void refreshRealtimeMessages(queryClient, controller.signal).catch(() => {});
        for (const queryKey of [
          ['conversations'],
          ['notifications'],
          ['match'],
          ['matches'],
          ['online-status'],
          ['typing'],
        ]) {
          void queryClient.cancelQueries({ queryKey }).then(() => {
            if (active) return queryClient.invalidateQueries({ queryKey });
          });
        }
      },
      (state) => {
        if (active) setConnection({ ...state, userId, sessionId, revision });
      },
    );
    return () => {
      active = false;
      controller.abort();
      dispose();
    };
  }, [userId, sessionId, queryClient, revision]);
  const owned =
    connection?.userId === userId &&
    connection?.sessionId === sessionId &&
    connection?.revision === revision
      ? connection
      : null;
  const leaseId = owned?.status === 'connected' ? owned.leaseId : null;
  const counter = useRef({ leaseId: '', value: 0 });
  const [presence, setPresence] = useState<{
    leaseId: string;
    revision: number;
    unavailable: boolean;
  } | null>(null);
  useEffect(() => {
    if (!userId || !sessionId || !leaseId) return;
    if (counter.current.leaseId !== leaseId) counter.current = { leaseId, value: 0 };
    return maintainPresence({ userId, sessionId }, leaseId, counter.current, (unavailable) => {
      setPresence({ leaseId, revision, unavailable });
    });
  }, [userId, sessionId, leaseId, revision]);
  return (
    <RealtimeContext.Provider
      value={{
        enabled,
        status: owned?.status ?? 'connecting',
        leaseId: owned?.leaseId ?? null,
        retry,
      }}
    >
      {presence?.leaseId === leaseId &&
        presence?.revision === revision &&
        presence?.unavailable && (
          <div role="alert" className="flex items-center justify-center gap-2 p-2 text-sm">
            Online status is unavailable.
            <Button type="button" variant="ghost" onClick={retry}>
              Retry online status
            </Button>
          </div>
        )}
      {children}
    </RealtimeContext.Provider>
  );
}
