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
    return conversations.filter((conv) =>
      conv.otherUser.name.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);

  const unreadConversations = useMemo(
    () => filteredConversations.filter((conv) => conv.unreadCount > 0),
    [filteredConversations]
  );

  const readConversations = useMemo(
    () => filteredConversations.filter((conv) => conv.unreadCount === 0),
    [filteredConversations]
  );

  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (message: { matchId: string }) => {
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
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='w-8 h-8 animate-spin text-primary-main' />
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center px-4'>
        <p className='text-error font-semibold mb-2'>
          Failed to load conversations
        </p>
        <p className='text-text-muted text-sm'>Please try again later</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center px-4'>
        <MessageCircle className='w-16 h-16 text-text-muted mb-4 opacity-50' />
        <h3 className='text-lg font-semibold text-text-heading mb-2'>
          No conversations yet
        </h3>
        <p className='text-text-muted max-w-sm'>
          Start swiping and matching with people to begin chatting!
        </p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full'>
      {/* Search Bar */}
      <div className='p-3 border-b border-border-main bg-bg-card sticky top-0 z-10'>
        <div className='relative'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted' />
          <Input
            type='text'
            placeholder='Search conversations...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-10 pr-10 bg-bg-input border-border-input dark:border-secondary-main focus:border-primary-main transition-colors'
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className='absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-heading transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className='flex-1 overflow-y-auto'>
        {filteredConversations.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12 text-center px-4'>
            <Search className='w-12 h-12 text-text-muted mb-3 opacity-50' />
            <p className='text-text-muted'>No conversations found</p>
          </div>
        ) : (
          <>
            {/* Unread Conversations */}
            {unreadConversations.length > 0 && (
              <div>
                <div className='px-4 py-2 bg-bg-main sticky top-0 z-10'>
                  <h3 className='text-xs font-semibold text-text-muted uppercase tracking-wider'>
                    Unread ({unreadConversations.length})
                  </h3>
                </div>
                <div className='divide-y divide-border-main'>
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
                  <div className='px-4 py-2 bg-bg-main sticky top-0 z-10'>
                    <h3 className='text-xs font-semibold text-text-muted uppercase tracking-wider'>
                      All Messages
                    </h3>
                  </div>
                )}
                <div className='divide-y divide-border-main'>
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
