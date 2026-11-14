'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { browserRealtimeConfiguration } from '@/lib/client/env';
import { subscribeRealtime } from '@/lib/client/realtime';
import { refreshRealtimeMessages } from '@/lib/client/realtime-queries';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  const queryClient = useQueryClient();
  useEffect(() => {
    const configuration = browserRealtimeConfiguration();
    if (!configuration || !userId || !sessionId) return;
    let active = true;
    const controller = new AbortController();
    const dispose = subscribeRealtime({ userId, sessionId }, configuration, () => {
      void refreshRealtimeMessages(queryClient, controller.signal).catch(() => {});
      for (const queryKey of [
        ['conversations'],
        ['notifications'],
        ['match'],
        ['matches'],
        ['online-status'],
      ]) {
        void queryClient.cancelQueries({ queryKey }).then(() => {
          if (active) return queryClient.invalidateQueries({ queryKey });
        });
      }
    });
    return () => {
      active = false;
      controller.abort();
      dispose();
    };
  }, [userId, sessionId, queryClient]);
  return children;
}
