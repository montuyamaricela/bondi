'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { NotificationType } from '@prisma/client';

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
}

interface NotificationsResponse {
  notifications: Notification[];
}

interface NotificationCountResponse {
  count: number;
}

export function useNotificationsQuery(options?: { limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: ['notifications', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.unreadOnly) params.set('unreadOnly', 'true');

      return await api.get<NotificationsResponse>(`/api/notifications?${params.toString()}`);
    },
  });
}

export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: ['notifications', 'count'],
    queryFn: async () => {
      return await api.get<NotificationCountResponse>('/api/notifications/count');
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
