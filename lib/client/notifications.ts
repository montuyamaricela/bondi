'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { NotificationType } from '@prisma/client';
import { useSession } from '@/lib/auth-client';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  isRead: boolean;
  type: NotificationType;
  entityId: string | null;
  actionUrl: string | null;
  metadata: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
  canNotify?: boolean;
}

interface NotificationsResponse {
  notifications: Notification[];
}

interface NotificationCountResponse {
  count: number;
}

export function useNotificationsQuery(options?: { limit?: number; unreadOnly?: boolean }) {
  const { data: session } = useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  return useQuery({
    queryKey: ['notifications', userId, sessionId, options],
    enabled: !!userId && !!sessionId,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.unreadOnly) params.set('unreadOnly', 'true');

      const result = await api.get<NotificationsResponse>(
        `/api/notifications?${params.toString()}`,
        { signal },
      );
      if (result.notifications.some((notification) => notification.userId !== userId))
        throw new Error('Session changed');
      return result;
    },
  });
}

export function useUnreadNotificationsCount() {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['notifications', session?.user.id, session?.session.id, 'count'],
    enabled: !!session?.user.id && !!session?.session.id,
    queryFn: async ({ signal }) => {
      return await api.get<NotificationCountResponse>('/api/notifications/count', { signal });
    },
    refetchInterval: 30000,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { ids: string | string[]; isRead: boolean }) => {
      return await api.patch('/api/notifications', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await api.patch('/api/notifications/mark-all-read', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
