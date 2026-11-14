'use client';

import { useState, useMemo, useEffect } from 'react';
import { Loader2, MessageCircle, Search, X } from 'lucide-react';
import { useConversations } from '@/app/components/features/messaging/hooks';
import { ConversationCard } from '@/app/components/features/messaging/components/ConversationCard';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';

interface ConversationListProps {
  currentUserId: string;
}

export function ConversationList({ currentUserId }: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  const searching = search !== searchQuery.trim();
  const {
    data: conversations = [],
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch,
  } = useConversations(search);

  const unreadConversations = useMemo(
    () => conversations.filter((conv) => conv.unreadCount > 0),
    [conversations],
  );

  const readConversations = useMemo(
    () => conversations.filter((conv) => conv.unreadCount === 0),
    [conversations],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Search Bar */}
      <div className="sticky top-0 z-10 border-b border-border-main bg-bg-card p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="text"
            aria-label="Search conversations"
            maxLength={100}
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border-input bg-bg-input pr-10 pl-10 transition-colors focus:border-primary-main dark:border-secondary-main"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear conversation search"
              onClick={() => setSearchQuery('')}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-text-muted transition-colors hover:text-text-heading"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading || searching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
          </div>
        ) : error && !conversations.length ? (
          <div className="p-4 text-center">
            <p role="alert" className="mb-2 text-error">
              Failed to load conversations
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetch();
              }}
            >
              Retry conversations
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            {search ? (
              <Search className="mb-3 h-12 w-12 text-text-muted opacity-50" />
            ) : (
              <MessageCircle className="mb-3 h-12 w-12 text-text-muted opacity-50" />
            )}
            <h3 className="mb-2 font-semibold text-text-heading">
              {search ? 'No conversations found' : 'No conversations yet'}
            </h3>
            <p className="text-sm text-text-muted">
              {search
                ? 'Try another name.'
                : 'Start swiping and matching with people to begin chatting!'}
            </p>
          </div>
        ) : (
          <>
            {/* Unread Conversations */}
            {unreadConversations.length > 0 && (
              <div>
                <div className="sticky top-0 z-10 bg-bg-main px-4 py-2">
                  <h3 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                    Unread ({unreadConversations.length})
                  </h3>
                </div>
                <div className="divide-y divide-border-main">
                  {unreadConversations.map((conversation) => (
                    <ConversationCard
                      key={conversation.matchId}
                      conversation={conversation}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Read Conversations */}
            {readConversations.length > 0 && (
              <div>
                {unreadConversations.length > 0 && (
                  <div className="sticky top-0 z-10 bg-bg-main px-4 py-2">
                    <h3 className="text-xs font-semibold tracking-wider text-text-muted uppercase">
                      All Messages
                    </h3>
                  </div>
                )}
                <div className="divide-y divide-border-main">
                  {readConversations.map((conversation) => (
                    <ConversationCard
                      key={conversation.matchId}
                      conversation={conversation}
                      currentUserId={currentUserId}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {hasNextPage && !searching && !isLoading && (
          <div className="p-4 text-center">
            {isFetchNextPageError && (
              <p role="alert" className="mb-2 text-sm text-error">
                Could not load more conversations. Try again.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={isFetchingNextPage}
              onClick={() => {
                void fetchNextPage().catch(() => {});
              }}
            >
              Load more conversations
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
