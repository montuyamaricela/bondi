'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import type { MatchDetail } from '@/app/components/features/matching/hooks';
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/socket';
import { browserSocketUrl } from '@/lib/client/env';

type SocketContextType = {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
};

type OwnedConnection = SocketContextType & { userId: string; sessionId: string };

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const userId = session?.user.id ?? null;
  const sessionId = session?.session.id ?? null;
  const [connection, setConnection] = useState<OwnedConnection | null>(null);

  useEffect(() => {
    if (!userId || !sessionId) return;

    let active = true;
    const controller = new AbortController();
    let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
    const updateConnection = (isConnected: boolean) => {
      if (active && socketInstance)
        setConnection({ userId, sessionId, socket: socketInstance, isConnected });
    };

    const refresh = (queryKey: readonly string[]) => {
      if (!active) return;
      void queryClient.cancelQueries({ queryKey }).then(() => {
        if (active) return queryClient.invalidateQueries({ queryKey });
      });
    };

    // Fetch socket token from API endpoint
    const initSocket = async () => {
      try {
        const response = await fetch('/api/socket/token', {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!active) return;

        if (!response.ok) {
          console.error('Failed to get socket token');
          return;
        }

        const payload: unknown = await response.json();
        if (!active) return;
        if (
          !payload ||
          typeof payload !== 'object' ||
          !('token' in payload) ||
          typeof payload.token !== 'string' ||
          !payload.token
        ) {
          console.error('Invalid socket token response');
          return;
        }
        if (
          !('userId' in payload) ||
          payload.userId !== userId ||
          !('sessionId' in payload) ||
          payload.sessionId !== sessionId
        )
          return;

        const socketUrl = browserSocketUrl();

        socketInstance = io(socketUrl, {
          auth: {
            token: payload.token,
          },
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
          updateConnection(true);
          refresh(['conversations']);
          refresh(['notifications']);
        });

        socketInstance.on('disconnect', () => {
          updateConnection(false);
        });

        socketInstance.on('connect_error', () => {
          if (!active) return;
          console.error('Socket connection failed');
          updateConnection(false);
        });

        socketInstance.on('auth:error', ({ message }) => {
          if (!active) return;
          toast.error(message);
          updateConnection(false);
        });

        socketInstance.on('message:error', ({ message }) => {
          if (active) toast.error(message);
        });
        socketInstance.on('inbox:updated', () => refresh(['conversations']));
        socketInstance.on('notification:new', () => refresh(['notifications']));
        socketInstance.on('match:updated', ({ matchId, status }) => {
          if (!active) return;
          queryClient.setQueryData<MatchDetail>(['match', matchId], (previous) =>
            previous ? { ...previous, status } : undefined,
          );
          void queryClient.invalidateQueries({ queryKey: ['match', matchId], exact: true });
          void queryClient.invalidateQueries({ queryKey: ['matches'] });
          refresh(['conversations']);
          refresh(['notifications']);
          refresh(['messages', matchId]);
        });

        updateConnection(false);
      } catch {
        if (active) console.error('Socket initialization failed');
      }
    };

    void initSocket();

    return () => {
      active = false;
      controller.abort();
      if (socketInstance) {
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
      }
    };
  }, [userId, sessionId, queryClient]);

  const current =
    connection?.userId === userId && connection?.sessionId === sessionId ? connection : null;

  return (
    <SocketContext.Provider
      value={{ socket: current?.socket ?? null, isConnected: current?.isConnected ?? false }}
    >
      {children}
    </SocketContext.Provider>
  );
}
