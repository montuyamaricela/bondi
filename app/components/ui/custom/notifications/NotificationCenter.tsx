'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/app/components/ui/popover';
import { Button } from '@/app/components/ui/button';
import { Separator } from '@/app/components/ui/separator';
import { Badge } from '@/app/components/ui/badge';
import { NotificationItem } from './NotificationItem';
import { NotificationListSkeleton } from './NotificationSkeleton';
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useUnreadNotificationsCount,
  useMarkAllNotificationsReadMutation,
} from '@/lib/client/notifications';
import { useNotifications } from '@/app/components/hooks/useNotifications';
import { toast } from 'sonner';
import { useSession } from '@/lib/auth-client';

interface NotificationCenterProps {
  maxNotifications?: number;
}

function notificationSettings() {
  try {
    const saved = localStorage.getItem('notificationSettings');
    if (!saved) return { matchNotifications: true, messageNotifications: true };
    const parsed: unknown = JSON.parse(saved);
    return {
      matchNotifications:
        !!parsed &&
        typeof parsed === 'object' &&
        'matchNotifications' in parsed &&
        parsed.matchNotifications === true,
      messageNotifications:
        !!parsed &&
        typeof parsed === 'object' &&
        'messageNotifications' in parsed &&
        parsed.messageNotifications === true,
    };
  } catch {
    return { matchNotifications: false, messageNotifications: false };
  }
}

export function NotificationCenter({ maxNotifications = 20 }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user.id;
  const sessionId = session?.session.id;
  const nativeSeen = useRef<{
    userId?: string;
    sessionId?: string;
    initialized: boolean;
    ids: Set<string>;
  }>({ initialized: false, ids: new Set() });
  const { permission, showMatchNotification, showMessageNotification } = useNotifications();

  const {
    data: notificationsData,
    isLoading,
    isError,
    refetch: refetchNotifications,
  } = useNotificationsQuery({
    limit: maxNotifications,
  });

  const { data: unreadData, refetch: refetchUnreadCount } = useUnreadNotificationsCount();
  const unreadCount = unreadData?.count || 0;

  const { mutate: markAsRead } = useMarkNotificationReadMutation();
  const { mutate: markAllAsRead } = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    if (!userId || !sessionId || !notificationsData) return;
    if (nativeSeen.current.userId !== userId || nativeSeen.current.sessionId !== sessionId)
      nativeSeen.current = { userId, sessionId, initialized: false, ids: new Set() };
    const messages = notificationsData.notifications.filter(
      (notification) =>
        notification.userId === userId && ['MESSAGE', 'MATCH'].includes(notification.type),
    );
    if (!nativeSeen.current.initialized) {
      for (const notification of messages) nativeSeen.current.ids.add(notification.id);
      nativeSeen.current.initialized = true;
      return;
    }
    for (const notification of messages) {
      if (nativeSeen.current.ids.has(notification.id)) continue;
      nativeSeen.current.ids.add(notification.id);
      if (notification.isRead || !notification.canNotify) continue;
      const settings = notificationSettings();
      if (notification.type === 'MATCH') {
        toast.success("It's a match! 🎉");
        if (permission === 'granted' && settings.matchNotifications)
          showMatchNotification('New Match', 'You have a new match!');
      } else {
        toast.info('New message received');
        if (permission === 'granted' && settings.messageNotifications)
          showMessageNotification('New Message', 'You have a new message');
      }
    }
  }, [
    userId,
    sessionId,
    notificationsData,
    permission,
    showMessageNotification,
    showMatchNotification,
  ]);

  useEffect(() => {
    if (open) {
      refetchNotifications();
      refetchUnreadCount();
    }
  }, [open, refetchNotifications, refetchUnreadCount]);

  const handleNotificationClick = (actionUrl: string | null) => {
    if (actionUrl) {
      setOpen(false);
      router.push(actionUrl);
    }
  };

  const handleMarkAsRead = (id: string, isRead: boolean) => {
    markAsRead({ ids: id, isRead });
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Notifications"
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 cursor-pointer rounded-full transition-colors hover:bg-primary-main hover:text-white dark:hover:bg-secondary-main dark:hover:text-secondary-text hover:[&_svg]:text-white"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center border-0 bg-error p-0 px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] rounded-xl border-border-main/40 p-0 shadow-xl md:w-[360px]"
        align="end"
      >
        <div className="flex items-center justify-between p-3">
          <h3 className="text-sm font-semibold text-text-heading">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-primary-main hover:text-white hover:[&_svg]:text-white"
              onClick={handleMarkAllAsRead}
              title="Mark all as read"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
        </div>

        <Separator />

        <div className="max-h-[60vh] overflow-y-auto md:max-h-[400px]">
          {isLoading ? (
            <NotificationListSkeleton />
          ) : isError ? (
            <div className="p-4 text-center text-xs text-text-muted">
              <div className="rounded-lg bg-bg-input p-3">Failed to load notifications</div>
            </div>
          ) : notificationsData?.notifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="mx-auto mb-3 h-12 w-12 text-text-muted opacity-40" />
              <p className="text-sm text-text-muted">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notificationsData?.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onClick={() => handleNotificationClick(notification.actionUrl)}
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
