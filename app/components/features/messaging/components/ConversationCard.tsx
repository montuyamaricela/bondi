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

export function ConversationCard({
  conversation,
  currentUserId,
}: ConversationCardProps) {
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
          'bg-primary-main/10 border-l-4 border-l-primary-main dark:border-l-secondary-main dark:bg-secondary-main/10'
      )}
    >
      <div
        className={cn(
          'flex items-start gap-4 p-4 transition-colors duration-200',
          !isActive &&
            'border-b border-border-main group-hover:border-transparent'
        )}
      >
        <div className='relative shrink-0'>
          <div
            className={cn(
              'w-14 h-14 rounded-full overflow-hidden bg-bg-input relative ring-2 ring-transparent transition-all duration-200',
              !isActive && 'group-hover:ring-white/20'
            )}
          >
            {otherUser.image ? (
              <Image
                src={otherUser.image}
                alt={otherUser.name}
                fill
                className={cn(
                  'object-cover transition-transform duration-200',
                  !isActive && 'group-hover:scale-110'
                )}
                sizes='56px'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center bg-primary-main  text-primary-text text-xl font-semibold'>
                {otherUser.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className='absolute bottom-0 right-0'>
            <OnlineStatusIndicator
              userId={otherUser.userId}
              showOnlineStatus={otherUser.showOnlineStatus}
              size='md'
            />
          </div>
          {unreadCount > 0 && (
            <div className='absolute -top-1 -right-1 w-5 h-5 rounded-full bg-app-accent text-app-accent-text flex items-center justify-center text-xs font-bold shadow-lg animate-pulse'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </div>
          )}
        </div>

        <div className='flex-1 min-w-0'>
          <div className='flex items-baseline justify-between gap-2 mb-1'>
            <h3
              className={cn(
                'font-semibold truncate transition-colors duration-200',
                isActive && 'text-primary-main dark:text-primary-text',
                !isActive && 'text-text-heading group-hover:text-white'
              )}
            >
              {otherUser.name}
              {otherUser.age && (
                <span
                  className={cn(
                    'font-normal transition-colors duration-200',
                    isActive && 'text-text-muted',
                    !isActive && 'text-text-muted group-hover:text-white/80'
                  )}
                >
                  , {otherUser.age}
                </span>
              )}
            </h3>
            <span
              className={cn(
                'text-xs shrink-0 transition-colors duration-200',
                isActive &&
                  'text-primary-main dark:text-primary-text font-medium',
                !isActive && 'text-text-muted group-hover:text-white/80'
              )}
            >
              {formattedTime}
            </span>
          </div>

          {isUnmatched && (
            <p
              className={cn(
                'text-xs text-text-muted mb-1 italic transition-colors duration-200',
                !isActive && 'group-hover:text-white/70'
              )}
            >
              Unmatched
            </p>
          )}
          <p
            className={cn(
              'text-sm truncate transition-colors duration-200',
              unreadCount > 0
                ? 'font-semibold text-text-body'
                : 'text-text-muted',
              isActive && 'text-text-body',
              !isActive && 'group-hover:text-white/90'
            )}
          >
            {lastMessage ? (
              <>
                {isOwnMessage && (
                  <span
                    className={cn(
                      'transition-colors duration-200',
                      isActive && 'text-text-muted',
                      !isActive && 'text-text-muted group-hover:text-white/70'
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
                  !isActive && 'text-text-muted group-hover:text-white/70'
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
