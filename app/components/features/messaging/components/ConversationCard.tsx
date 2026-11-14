'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import type { Conversation } from '../types';
import { cn } from '@/lib/utils';
import { OnlineStatusIndicator } from '@/app/components/ui/custom/OnlineStatusIndicator';
import { usePathname } from 'next/navigation';

interface ConversationCardProps {
  conversation: Conversation;
  currentUserId: string;
}

export function ConversationCard({ conversation, currentUserId }: ConversationCardProps) {
  const pathname = usePathname();
  const { matchId, otherUser, lastMessage, unreadCount, status } = conversation;

  const isOwnMessage = lastMessage?.senderId === currentUserId;
  const isUnmatched = status === 'UNMATCHED';
  const isActive = pathname === `/messages/${matchId}`;

  const formattedTime = lastMessage
    ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: true })
    : formatDistanceToNow(new Date(conversation.matchedAt), {
        addSuffix: true,
      });

  return (
    <Link
      href={`/messages/${matchId}`}
      className={cn(
        'group block transition-all duration-200',
        !isActive && 'hover:bg-primary-main dark:hover:bg-secondary-main',
        isActive &&
          'border-l-4 border-l-primary-main bg-primary-main/10 dark:border-l-secondary-main dark:bg-secondary-main/10',
      )}
    >
      <div
        className={cn(
          'flex items-start gap-4 p-4 transition-colors duration-200',
          !isActive && 'border-b border-border-main group-hover:border-transparent',
        )}
      >
        <div className="relative shrink-0">
          <div
            className={cn(
              'relative h-14 w-14 overflow-hidden rounded-full bg-bg-input ring-2 ring-transparent transition-all duration-200',
              !isActive && 'group-hover:ring-white/20',
            )}
          >
            {otherUser.image ? (
              <Image
                src={otherUser.image}
                alt={otherUser.name}
                fill
                className={cn(
                  'object-cover transition-transform duration-200',
                  !isActive && 'group-hover:scale-110',
                )}
                sizes="56px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-main text-xl font-semibold text-primary-text">
                {otherUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="absolute right-0 bottom-0">
            <OnlineStatusIndicator
              userId={otherUser.userId}
              showOnlineStatus={otherUser.showOnlineStatus}
              size="md"
            />
          </div>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 flex h-5 w-5 animate-pulse items-center justify-center rounded-full bg-app-accent text-xs font-bold text-app-accent-text shadow-lg">
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3
              className={cn(
                'truncate font-semibold transition-colors duration-200',
                isActive && 'text-primary-main dark:text-primary-text',
                !isActive && 'text-text-heading group-hover:text-white',
              )}
            >
              {otherUser.name}
              {otherUser.age && (
                <span
                  className={cn(
                    'font-normal transition-colors duration-200',
                    isActive && 'text-text-muted',
                    !isActive && 'text-text-muted group-hover:text-white/80',
                  )}
                >
                  , {otherUser.age}
                </span>
              )}
            </h3>
            <span
              className={cn(
                'shrink-0 text-xs transition-colors duration-200',
                isActive && 'font-medium text-primary-main dark:text-primary-text',
                !isActive && 'text-text-muted group-hover:text-white/80',
              )}
            >
              {formattedTime}
            </span>
          </div>

          {isUnmatched && (
            <p
              className={cn(
                'mb-1 text-xs text-text-muted italic transition-colors duration-200',
                !isActive && 'group-hover:text-white/70',
              )}
            >
              Unmatched
            </p>
          )}
          <p
            className={cn(
              'truncate text-sm transition-colors duration-200',
              unreadCount > 0 ? 'font-semibold text-text-body' : 'text-text-muted',
              isActive && 'text-text-body',
              !isActive && 'group-hover:text-white/90',
            )}
          >
            {lastMessage ? (
              <>
                {isOwnMessage && (
                  <span
                    className={cn(
                      'transition-colors duration-200',
                      isActive && 'text-text-muted',
                      !isActive && 'text-text-muted group-hover:text-white/70',
                    )}
                  >
                    You:{' '}
                  </span>
                )}
                {lastMessage.content}
              </>
            ) : (
              <span
                className={cn(
                  'italic transition-colors duration-200',
                  isActive && 'text-text-muted',
                  !isActive && 'text-text-muted group-hover:text-white/70',
                )}
              >
                Start a conversation!
              </span>
            )}
          </p>
        </div>
      </div>
    </Link>
  );
}
