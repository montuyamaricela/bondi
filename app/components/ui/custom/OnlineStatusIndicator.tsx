'use client';

import { useOnlineStatus } from '@/app/components/features/messaging/useOnlineStatus';
import { cn } from '@/lib/utils';

interface OnlineStatusIndicatorProps {
  userId: string;
  enabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function OnlineStatusIndicator({
  userId,
  enabled = true,
  size = 'md',
}: OnlineStatusIndicatorProps) {
  const presence = useOnlineStatus(userId, enabled);
  if (presence.unavailable)
    return (
      <span
        role="img"
        aria-label="Online status unavailable"
        title="Online status unavailable"
        className="text-xs text-text-muted"
      >
        ?
      </span>
    );
  if (!presence.online || !presence.visible) return null;

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  return (
    <div
      className={cn('rounded-full bg-success', sizeClasses[size], 'ring-2 ring-bg-card')}
      title="Online"
    />
  );
}
