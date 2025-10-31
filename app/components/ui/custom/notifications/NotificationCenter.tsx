'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
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
import { useSocket } from '@/app/components/providers/socket-provider';
import { useNotifications } from '@/app/components/hooks/useNotifications';
import { toast } from 'sonner';

interface NotificationCenterProps {
  maxNotifications?: number;
}

export function NotificationCenter({
  maxNotifications = 20,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { socket } = useSocket();
  const { permission, showMatchNotification, showMessageNotification } =
    useNotifications();

  const {
    data: notificationsData,
    isLoading,
    isError,
    refetch: refetchNotifications,
  } = useNotificationsQuery({
    limit: maxNotifications,
  });

  const { data: unreadData, refetch: refetchUnreadCount } =
    useUnreadNotificationsCount();
  const unreadCount = unreadData?.count || 0;

  const { mutate: markAsRead } = useMarkNotificationReadMutation();
  const { mutate: markAllAsRead } = useMarkAllNotificationsReadMutation();

  useEffect(() => {
    if (open) {
      refetchNotifications();
      refetchUnreadCount();
    }
  }, [open, refetchNotifications, refetchUnreadCount]);

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = async (data: {
      type: string;
      matchId?: string;
    }) => {
      refetchNotifications();
      refetchUnreadCount();

      const notificationSettings = localStorage.getItem('notificationSettings');
      const settings = notificationSettings
        ? JSON.parse(notificationSettings)
        : { matchNotifications: true, messageNotifications: true };

      if (data.type === 'MESSAGE') {
        toast.info('New message received');

        if (permission === 'granted' && settings.messageNotifications) {
          showMessageNotification('New Message', 'You have a new message');
        }
      } else if (data.type === 'MATCH') {
        toast.success("It's a match! 🎉");

        if (permission === 'granted' && settings.matchNotifications) {
          showMatchNotification('New Match', 'You have a new match!');
        }
      }
    };

    socket.on('notification:new', handleNewNotification);

    return () => {
      socket.off('notification:new', handleNewNotification);
    };
  }, [
    socket,
    refetchNotifications,
    refetchUnreadCount,
    permission,
    showMatchNotification,
    showMessageNotification,
  ]);

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
          variant='ghost'
          size='icon'
          className='relative rounded-full h-8 w-8 hover:bg-primary-main hover:text-white hover:[&_svg]:text-white transition-colors cursor-pointer dark:hover:bg-secondary-main dark:hover:text-secondary-text'
        >
          <Bell className='h-4 w-4' />
          {unreadCount > 0 && (
            <Badge className='absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[10px] font-medium bg-error text-white border-0'>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='w-[calc(100vw-2rem)] md:w-[360px] p-0 rounded-xl shadow-xl border-border-main/40'
        align='end'
      >
        <div className='flex items-center justify-between p-3'>
          <h3 className='text-sm font-semibold text-text-heading'>
            Notifications
          </h3>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='icon'
              className='h-7 w-7 hover:bg-primary-main hover:text-white hover:[&_svg]:text-white'
              onClick={handleMarkAllAsRead}
              title='Mark all as read'
            >
              <CheckCircle className='h-4 w-4' />
            </Button>
          )}
        </div>

        <Separator />

        <div className='max-h-[60vh] md:max-h-[400px] overflow-y-auto'>
          {isLoading ? (
            <NotificationListSkeleton />
          ) : isError ? (
            <div className='p-4 text-center text-xs text-text-muted'>
              <div className='rounded-lg bg-bg-input p-3'>
                Failed to load notifications
              </div>
            </div>
          ) : notificationsData?.notifications.length === 0 ? (
            <div className='p-6 text-center'>
              <Bell className='h-12 w-12 text-text-muted mx-auto mb-3 opacity-40' />
              <p className='text-sm text-text-muted'>No notifications yet</p>
            </div>
          ) : (
            <div>
              {notificationsData?.notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onClick={() =>
                    handleNotificationClick(notification.actionUrl)
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
