'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useSocket } from '@/app/components/providers/socket-provider';
import { useMessages } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/app/components/ui/button';
import type { Message } from '../types';
import { cn } from '@/lib/utils';

interface ChatInterfaceProps {
  matchId: string;
  currentUserId: string;
  otherUserId: string;
  isUnmatched?: boolean;
}

export function ChatInterface({
  matchId,
  currentUserId,
  otherUserId,
  isUnmatched = false,
}: ChatInterfaceProps) {
  const { socket, isConnected } = useSocket();
  const { data: initialMessages = [], isLoading } = useMessages(matchId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMatchId, setCurrentMatchId] = useState(matchId);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const markedAsReadRef = useRef<Set<string>>(new Set<string>());

  // Reset messages when matchId changes
  if (matchId !== currentMatchId) {
    setMessages(initialMessages);
    setCurrentMatchId(matchId);
  }

  // Update messages when initial messages load
  if (
    matchId === currentMatchId &&
    !isLoading &&
    messages.length === 0 &&
    initialMessages.length > 0
  ) {
    setMessages(initialMessages);
  }

  // Clear marked messages when matchId changes
  useEffect(() => {
    const markedAsRead = markedAsReadRef.current;
    markedAsRead.clear();
  }, [matchId]);

  // Mark a message as read (helper function)
  const markMessageAsRead = useCallback(
    (messageId: string) => {
      if (!socket || !isConnected || markedAsReadRef.current.has(messageId))
        return;

      markedAsReadRef.current.add(messageId);
      socket.emit('message:read', { messageId });
    },
    [socket, isConnected]
  );

  // Socket connection and event handlers
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.emit('match:join', { matchId });

    // Mark initial unread messages as read
    initialMessages.forEach((msg) => {
      if (!msg.readAt && msg.senderId !== currentUserId) {
        markMessageAsRead(msg.id);
      }
    });

    const handleNewMessage = (message: {
      id: string;
      matchId: string;
      senderId: string;
      content: string;
      createdAt: string;
    }) => {
      if (message.matchId === matchId) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === message.id);
          if (exists) return prev;
          return [...prev, { ...message, readAt: null }];
        });

        // Mark new message as read if it's from other user
        if (message.senderId !== currentUserId) {
          markMessageAsRead(message.id);
        }
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId ? { ...msg, readAt: data.readAt } : msg
        )
      );
    };

    const handleTypingStart = (data: { userId: string; matchId: string }) => {
      if (data.matchId === matchId && data.userId === otherUserId) {
        setIsTyping(true);
      }
    };

    const handleTypingStop = (data: { userId: string; matchId: string }) => {
      if (data.matchId === matchId && data.userId === otherUserId) {
        setIsTyping(false);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      socket.emit('match:leave', { matchId });
    };
  }, [
    socket,
    isConnected,
    matchId,
    currentUserId,
    otherUserId,
    markMessageAsRead,
    initialMessages,
  ]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (value: string) => {
    setNewMessage(value);

    if (!socket || !isConnected) return;

    if (value.trim()) {
      socket.emit('typing:start', { matchId });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { matchId });
      }, 2000);
    } else {
      socket.emit('typing:stop', { matchId });
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim() || isSending || !socket || !isConnected || isUnmatched) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing:stop', { matchId });

    socket.emit('message:send', {
      matchId,
      content: messageContent,
    });

    setIsSending(false);
  };

  if (isLoading) {
    return (
      <div className='flex-1 flex items-center justify-center'>
        <Loader2 className='w-8 h-8 animate-spin text-primary-main' />
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full overflow-hidden'>
      <div className='flex-1 overflow-y-auto p-4 space-y-2'>
        {messages.length === 0 ? (
          <div className='flex items-center justify-center h-full'>
            <p className='text-text-muted text-center'>
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.senderId === currentUserId}
            />
          ))
        )}
        {isTyping && (
          <div className='flex justify-start mb-4'>
            <div className='bg-bg-card text-text-muted border border-border-main rounded-2xl px-4 py-2 rounded-bl-sm'>
              <div className='flex gap-1'>
                <span className='w-2 h-2 bg-text-muted rounded-full animate-bounce'></span>
                <span
                  className='w-2 h-2 bg-text-muted rounded-full animate-bounce'
                  style={{ animationDelay: '0.2s' }}
                ></span>
                <span
                  className='w-2 h-2 bg-text-muted rounded-full animate-bounce'
                  style={{ animationDelay: '0.4s' }}
                ></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className='border-t border-border-main bg-bg-card p-4'>
        {isUnmatched ? (
          <div className='text-center py-3 px-4 bg-bg-hover border border-border-main rounded-lg'>
            <p className='text-sm text-text-muted'>
              You've unmatched with this person. You can view chat history but cannot send new messages.
            </p>
          </div>
        ) : (
          <>
            {!isConnected && (
              <div className='mb-2 text-center text-sm text-warning'>
                Connecting to server...
              </div>
            )}
            <form onSubmit={handleSendMessage} className='flex gap-2'>
              <input
                type='text'
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder='Type a message...'
                className={cn(
                  'flex-1 px-4 py-2 rounded-full border bg-bg-input text-text-body',
                  'border-border-input focus:outline-none focus:border-primary-main',
                  'placeholder:text-text-muted'
                )}
                maxLength={5000}
                disabled={isSending || !isConnected}
              />
              <Button
                type='submit'
                disabled={!newMessage.trim() || isSending || !isConnected}
                className='rounded-full w-10 h-10 p-0 bg-primary-main text-primary-text hover:bg-primary-hover'
              >
                {isSending ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  <Send className='w-5 h-5' />
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
