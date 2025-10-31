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

export function NotificationItem({
  notification,
  onMarkAsRead,
  onClick,
}: NotificationItemProps) {
  const getIcon = () => {
    switch (notification.type) {
      case 'MATCH':
        return <Heart className="h-4 w-4 text-pink-500" />;
      case 'MESSAGE':
        return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case 'LIKE':
        return <Heart className="h-4 w-4 text-red-500" />;
      case 'PROFILE_VIEW':
        return <Eye className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-text-muted" />;
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
      onClick={handleClick}
      className={cn(
        'group flex items-start gap-3 p-3 cursor-pointer transition-colors hover:bg-bg-hover',
        !notification.isRead && 'bg-primary-main/5'
      )}
    >
      <div className="flex-shrink-0 mt-1">{getIcon()}</div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm',
              notification.isRead ? 'text-text-body' : 'text-text-heading font-semibold'
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-main mt-1" />
          )}
        </div>

        <p className="text-xs text-text-muted mt-1 line-clamp-2">
          {notification.content}
        </p>

        <p className="text-xs text-text-muted mt-2">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>

      {!notification.isRead && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMarkAsRead(notification.id, true);
          }}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Mark as read"
        >
          <Check className="h-4 w-4 text-text-muted hover:text-primary-main" />
        </button>
      )}
    </div>
  );
}
