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
  otherUserImage?: string | null;
  otherUserName?: string;
  currentUserImage?: string | null;
  currentUserName?: string;
}

export function ChatInterface({
  matchId,
  currentUserId,
  otherUserId,
  isUnmatched = false,
  otherUserImage,
  otherUserName,
  currentUserImage,
  currentUserName,
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
      if (!socket || !isConnected || markedAsReadRef.current.has(messageId)) return;

      markedAsReadRef.current.add(messageId);
      socket.emit('message:read', { messageId });
    },
    [socket, isConnected],
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
          return [...prev, { ...message, type: 'TEXT' as const, readAt: null }];
        });

        // Mark new message as read if it's from other user
        if (message.senderId !== currentUserId) {
          markMessageAsRead(message.id);
        }
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string }) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === data.messageId ? { ...msg, readAt: data.readAt } : msg)),
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
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-main" />
      </div>
    );
  }

  return (
    <div className="custom-scrollbar flex h-full flex-col overflow-hidden">
      <div
        role="log"
        aria-label="Conversation messages"
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-text-muted">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.senderId === currentUserId}
              senderImage={otherUserImage}
              senderName={otherUserName}
              currentUserImage={currentUserImage}
              currentUserName={currentUserName}
            />
          ))
        )}
        {isTyping && (
          <div className="mb-4 flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border-main bg-bg-card px-4 py-2 text-text-muted">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-text-muted"></span>
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-text-muted"
                  style={{ animationDelay: '0.2s' }}
                ></span>
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-text-muted"
                  style={{ animationDelay: '0.4s' }}
                ></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-border-main bg-bg-card p-4">
        {isUnmatched ? (
          <div className="rounded-lg border border-border-main bg-bg-hover px-4 py-3 text-center">
            <p className="text-sm text-text-muted">
              You&apos;ve unmatched with this person. You can view chat history but cannot send new
              messages.
            </p>
          </div>
        ) : (
          <>
            {!isConnected && (
              <div className="mb-2 text-center text-sm text-warning">Connecting to server...</div>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                aria-label="Message"
                placeholder="Type a message..."
                className={cn(
                  'flex-1 rounded-full border bg-bg-input px-4 py-2 text-text-body',
                  'border-border-input focus:border-primary-main focus:outline-none',
                  'placeholder:text-text-muted',
                )}
                maxLength={5000}
                disabled={isSending || !isConnected}
              />
              <Button
                type="submit"
                aria-label="Send message"
                disabled={!newMessage.trim() || isSending || !isConnected}
                className="h-10 w-10 rounded-full bg-primary-main p-0 text-primary-text hover:bg-primary-hover"
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
