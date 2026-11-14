'use client';

import { useState, useMemo, useEffect } from 'react';
import { Loader2, MessageCircle, Search, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '@/app/components/providers/socket-provider';
import { useConversations } from '@/app/components/features/messaging/hooks';
import { ConversationCard } from '@/app/components/features/messaging/components/ConversationCard';
import { Input } from '@/app/components/ui/input';

interface ConversationListProps {
  currentUserId: string;
}

export function ConversationList({ currentUserId }: ConversationListProps) {
  const { data: conversations = [], isLoading, error } = useConversations();
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase();
    return conversations.filter((conv) => conv.otherUser.name.toLowerCase().includes(query));
  }, [conversations, searchQuery]);

  const unreadConversations = useMemo(
    () => filteredConversations.filter((conv) => conv.unreadCount > 0),
    [filteredConversations],
  );

  const readConversations = useMemo(
    () => filteredConversations.filter((conv) => conv.unreadCount === 0),
    [filteredConversations],
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = () => {
      console.log('ConversationList: Received message:new, invalidating conversations query');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleMessageRead = () => {
      console.log('ConversationList: Received message:read, invalidating conversations query');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    // Remove all previous listeners to prevent duplicates
    socket.off('message:new');
    socket.off('message:read');

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);

    console.log('ConversationList: Socket listeners registered');

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
    };
  }, [socket, isConnected, queryClient]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <p className="mb-2 font-semibold text-error">Failed to load conversations</p>
        <p className="text-sm text-text-muted">Please try again later</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <MessageCircle className="mb-4 h-16 w-16 text-text-muted opacity-50" />
        <h3 className="mb-2 text-lg font-semibold text-text-heading">No conversations yet</h3>
        <p className="max-w-sm text-text-muted">
          Start swiping and matching with people to begin chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search Bar */}
      <div className="sticky top-0 z-10 border-b border-border-main bg-bg-card p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-border-input bg-bg-input pr-10 pl-10 transition-colors focus:border-primary-main dark:border-secondary-main"
          />
          {searchQuery && (
            <button
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
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Search className="mb-3 h-12 w-12 text-text-muted opacity-50" />
            <p className="text-text-muted">No conversations found</p>
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
      </div>
    </div>
  );
}
