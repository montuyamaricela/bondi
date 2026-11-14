'use client';

import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Eye, Bell, Check } from 'lucide-react';
import type { Notification } from '@/lib/client/notifications';
import { cn } from '@/lib/utils';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string, isRead: boolean) => void;
  onClick: () => void;
}

export function NotificationItem({ notification, onMarkAsRead, onClick }: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'MATCH':
        return <Heart className="h-4 w-4 text-pink-500 group-hover:text-white" />;
      case 'MESSAGE':
        return <MessageCircle className="h-4 w-4 text-blue-500 group-hover:text-white" />;
      case 'LIKE':
        return <Heart className="h-4 w-4 text-red-500 group-hover:text-white" />;
      case 'PROFILE_VIEW':
        return <Eye className="h-4 w-4 text-purple-500 group-hover:text-white" />;
      default:
        return <Bell className="h-4 w-4 text-text-muted group-hover:text-white" />;
    }
  };

  const handleClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id, true);
    }
    onClick();
  };

  return (
    <div
      className={cn(
        'group flex cursor-pointer items-start gap-3 rounded-b-lg p-3 transition-colors hover:bg-primary-main',
        !notification.isRead && 'bg-primary-main/5',
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="mt-1 shrink-0">{getIcon()}</span>

        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'text-sm group-hover:text-white',
                notification.isRead ? 'text-text-body' : 'font-semibold text-text-heading',
              )}
            >
              {notification.title}
            </span>
            {!notification.isRead && (
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-main" />
            )}
          </span>

          <span className="mt-1 line-clamp-2 text-xs text-text-muted group-hover:text-white">
            {notification.content}
          </span>

          <span className="mt-1 block text-xs text-text-muted group-hover:text-white">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
            })}
          </span>
        </span>
      </button>
      {!notification.isRead && (
        <button
          type="button"
          onClick={() => {
            onMarkAsRead(notification.id, true);
          }}
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          title="Mark as read"
        >
          <Check className="h-4 w-4 text-text-muted group-hover:text-white" />
        </button>
      )}
    </div>
  );
}
