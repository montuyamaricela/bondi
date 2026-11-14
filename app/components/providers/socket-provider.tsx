'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';
import { useQueryClient } from '@tanstack/react-query';
import type { MatchDetail } from '@/app/components/features/matching/hooks';
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/socket';

type SocketContextType = {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  isConnected: boolean;
};

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
  const { data: session, isPending } = useSession();
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(
    null,
  );
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      return;
    }

    let socketInstance: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

    // Fetch socket token from API endpoint
    const initSocket = async () => {
      try {
        const response = await fetch('/api/socket/token', {
          credentials: 'include',
        });

        if (!response.ok) {
          console.error('Failed to get socket token');
          return;
        }

        const { token } = await response.json();

        if (!token) {
          console.error('No token returned from API');
          return;
        }

        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

        socketInstance = io(socketUrl, {
          auth: {
            token,
          },
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketInstance.on('connect', () => {
          console.log('Socket connected:', socketInstance?.id);
          setIsConnected(true);
        });

        socketInstance.on('disconnect', () => {
          console.log('Socket disconnected');
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
          setIsConnected(false);
        });

        socketInstance.on('auth:error', ({ message }) => {
          toast.error(message);
          setIsConnected(false);
        });

        socketInstance.on('message:error', ({ message }) => toast.error(message));
        socketInstance.on('match:updated', ({ matchId, status }) => {
          queryClient.setQueryData<MatchDetail>(['match', matchId], (previous) =>
            previous ? { ...previous, status } : undefined,
          );
          void queryClient.invalidateQueries({ queryKey: ['match', matchId], exact: true });
          void queryClient.invalidateQueries({ queryKey: ['matches'] });
          void queryClient.invalidateQueries({ queryKey: ['conversations'] });
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('Error initializing socket:', error);
      }
    };

    initSocket();

    return () => {
      if (socketInstance) {
        console.log('Cleaning up socket connection');
        socketInstance.disconnect();
      }
    };
  }, [session, isPending, queryClient]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>{children}</SocketContext.Provider>
  );
}
