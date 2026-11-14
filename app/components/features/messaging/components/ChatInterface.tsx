'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mergeSavedMessages } from '../message-state';
import { Send, Loader2 } from 'lucide-react';
import { useSocket } from '@/app/components/providers/socket-provider';
import { useMessages } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/app/components/ui/button';
import type { Message } from '../types';
import { cn } from '@/lib/utils';
import type { ServerToClientEvents } from '@/lib/socket';

const EMPTY_MESSAGES: Message[] = [];

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
  const queryClient = useQueryClient();
  const { data: messages = EMPTY_MESSAGES, isLoading } = useMessages(matchId);
  const [currentMatchId, setCurrentMatchId] = useState(matchId);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendOperationRef = useRef<{ id: string; matchId: string; content: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const markedAsReadRef = useRef<Set<string>>(new Set<string>());

  // Draft state belongs to the current conversation.
  if (matchId !== currentMatchId) {
    setCurrentMatchId(matchId);
    setNewMessage('');
    setIsSending(false);
    setSendError(null);
  }

  useEffect(
    () => () => {
      sendOperationRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [matchId, socket, isUnmatched],
  );

  // Clear marked messages when matchId changes
  useEffect(() => {
    const markedAsRead = markedAsReadRef.current;
    markedAsRead.clear();
  }, [matchId]);

  // Mark a message as read (helper function)
  const markMessageAsRead = useCallback(
    (messageId: string) => {
      if (!socket || !isConnected || isUnmatched || markedAsReadRef.current.has(messageId)) return;

      markedAsReadRef.current.add(messageId);
      socket.emit('message:read', { messageId });
    },
    [socket, isConnected, isUnmatched],
  );

  // Socket connection and event handlers
  useEffect(() => {
    if (!socket || !isConnected || isUnmatched) return;

    let active = true;

    const handleNewMessage = (message: Parameters<ServerToClientEvents['message:new']>[0]) => {
      if (message.matchId === matchId) {
        queryClient.setQueryData<Message[]>(['messages', matchId], (previous) =>
          mergeSavedMessages(matchId, previous ?? [], [
            { ...message, readAt: message.readAt ?? null },
          ]),
        );
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string }) => {
      queryClient.setQueryData<Message[]>(['messages', matchId], (previous) =>
        previous
          ? mergeSavedMessages(
              matchId,
              previous,
              previous.map((message) =>
                message.id === data.messageId ? { ...message, readAt: data.readAt } : message,
              ),
            )
          : undefined,
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

    void socket
      .timeout(5000)
      .emitWithAck('match:join', { matchId })
      .then((result) => {
        if (!active) return;
        if (result.ok)
          return queryClient.invalidateQueries({ queryKey: ['messages', matchId], exact: true });
        void queryClient.invalidateQueries({ queryKey: ['match', matchId], exact: true });
        toast.error('Unable to join live chat. Reconnect to try again.');
      })
      .catch(() => {
        if (active) toast.error('Unable to reconnect to live chat.');
      });

    return () => {
      active = false;
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
      if (socket.connected) socket.emit('match:leave', { matchId });
    };
  }, [socket, isConnected, matchId, otherUserId, isUnmatched, queryClient]);

  useEffect(() => {
    messages.forEach((message) => {
      if (!message.readAt && message.senderId !== currentUserId) markMessageAsRead(message.id);
    });
  }, [messages, currentUserId, markMessageAsRead]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (sendOperationRef.current?.content !== value.trim()) sendOperationRef.current = null;
    setSendError(null);

    if (!socket || !isConnected || isUnmatched) return;

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
    const previous = sendOperationRef.current;
    const operation =
      previous?.matchId === matchId && previous.content === messageContent
        ? previous
        : { id: crypto.randomUUID(), matchId, content: messageContent };
    sendOperationRef.current = operation;
    setIsSending(true);
    setSendError(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing:stop', { matchId });

    try {
      const result = await socket.timeout(8000).emitWithAck('message:send', {
        matchId,
        content: messageContent,
        clientRequestId: operation.id,
      });
      if (sendOperationRef.current !== operation) return;
      setIsSending(false);
      if (!result.ok) {
        setSendError(result.message);
        return;
      }
      queryClient.setQueryData<Message[]>(['messages', matchId], (previousMessages) =>
        mergeSavedMessages(matchId, previousMessages ?? [], [
          { ...result.message, readAt: result.message.readAt ?? null },
        ]),
      );
      setNewMessage('');
      sendOperationRef.current = null;
    } catch {
      if (sendOperationRef.current !== operation) return;
      setIsSending(false);
      setSendError('Send not confirmed. Your draft is kept. Retry when connected.');
    }
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
        {isTyping && !isUnmatched && (
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
              This match has ended. You can still read the conversation.
            </p>
          </div>
        ) : (
          <>
            {!isConnected && (
              <div className="mb-2 text-center text-sm text-warning">Connecting to server...</div>
            )}
            {isSending && (
              <p role="status" className="mb-2 text-sm text-text-muted">
                Saving message...
              </p>
            )}
            {sendError && (
              <p
                role="alert"
                aria-label="Message send error"
                id="message-send-error"
                className="mb-2 text-sm text-warning"
              >
                {sendError}
              </p>
            )}
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => handleInputChange(e.target.value)}
                aria-label="Message"
                aria-describedby={sendError ? 'message-send-error' : undefined}
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
                aria-label={sendError ? 'Retry send' : 'Send message'}
                disabled={!newMessage.trim() || isSending || !isConnected}
                className={cn(
                  'h-10 rounded-full bg-primary-main text-primary-text hover:bg-primary-hover',
                  sendError ? 'px-4' : 'w-10 p-0',
                )}
              >
                {isSending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : sendError ? (
                  'Retry'
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
