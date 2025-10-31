'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/app/components/providers/socket-provider';
import { cn } from '@/lib/utils';
import { api } from '@/lib/fetch-wrapper';

interface OnlineStatusIndicatorProps {
  userId: string;
  showOnlineStatus?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function OnlineStatusIndicator({
  userId,
  showOnlineStatus = true,
  size = 'md',
}: OnlineStatusIndicatorProps) {
  const { socket, isConnected } = useSocket();
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    if (!socket || !showOnlineStatus) return;

    const handleUserOnline = (data: { userId: string }) => {
      if (data.userId === userId) {
        setIsOnline(true);
      }
    };

    const handleUserOffline = (data: { userId: string }) => {
      if (data.userId === userId) {
        setIsOnline(false);
      }
    };

    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);

    const checkInitialStatus = async () => {
      if (!isConnected) return;

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const response = await api.post<Record<string, boolean>>(
          '/api/users/online-status',
          { userIds: [userId] }
        );
        setIsOnline(response[userId] || false);
      } catch (error) {
        console.error('Failed to check initial online status:', error);
        setIsOnline(false);
      }
    };

    if (isConnected) {
      checkInitialStatus();
    }

    return () => {
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, [socket, userId, showOnlineStatus, isConnected]);

  if (!showOnlineStatus || !isOnline) {
    return null;
  }

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <div
      className={cn(
        'rounded-full bg-success',
        sizeClasses[size],
        'ring-2 ring-bg-card'
      )}
      title="Online"
    />
  );
}
