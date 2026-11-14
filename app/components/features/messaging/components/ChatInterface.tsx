'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { addSavedMessages, readSavedMessage, type MessagePages } from '../message-pages';
import { Send, Loader2 } from 'lucide-react';
import { useSocket } from '@/app/components/providers/socket-provider';
import { useMessages, useSendMessage, messageQueryKey } from '../hooks';
import { MessageBubble } from './MessageBubble';
import { Button } from '@/app/components/ui/button';
import type { Message } from '../types';
import { cn } from '@/lib/utils';
import type { ServerToClientEvents } from '@/lib/socket';
import { useSession } from '@/lib/auth-client';
import { useRealtime } from '@/app/components/providers/realtime-provider';
import { useChatActivity } from '../useChatActivity';
import { expectedChatOwner, chatAccessDenied } from '@/lib/client/chat-activity';
import { FetchError } from '@/lib/fetch-wrapper';
import type { ChatOwner } from '../activity-input';

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

export function ChatInterface(props: ChatInterfaceProps) {
  const { data: session, isPending } = useSession();
  const { enabled: native } = useRealtime();
  const sessionId = session?.session.id ?? '';
  const owner = useMemo(
    () => ({ userId: props.currentUserId, sessionId }),
    [props.currentUserId, sessionId],
  );
  if (native && (!sessionId || session?.user.id !== props.currentUserId))
    return (
      <div className="flex flex-1 items-center justify-center">
        {isPending ? (
          <Loader2 aria-label="Loading chat session" className="h-8 w-8 animate-spin" />
        ) : (
          <div role="alert">
            Your chat session changed. Refresh to continue.
            <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
              Refresh chat
            </Button>
          </div>
        )}
      </div>
    );
  return (
    <ChatView
      key={`${props.currentUserId}:${sessionId}:${props.matchId}`}
      {...props}
      owner={owner}
      native={native}
    />
  );
}

function ChatView({
  matchId,
  currentUserId,
  otherUserId,
  isUnmatched = false,
  otherUserImage,
  otherUserName,
  currentUserImage,
  currentUserName,
  owner,
  native,
}: ChatInterfaceProps & { owner: ChatOwner; native: boolean }) {
  const { socket, isConnected } = useSocket();
  const realtime = useRealtime();
  const legacySocket = native ? null : socket;
  const sendMessage = useSendMessage();
  const cacheKey = useMemo(
    () => messageQueryKey(matchId, native ? owner : undefined),
    [matchId, native, owner],
  );
  const queryClient = useQueryClient();
  const {
    data: messages = EMPTY_MESSAGES,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useMessages(matchId, native ? owner : undefined);
  const activity = useChatActivity(
    matchId,
    native ? owner : undefined,
    realtime.leaseId,
    native && realtime.status === 'connected',
    isUnmatched,
    messages,
  );
  const historyRef = useRef<HTMLDivElement>(null);
  const olderLoadingRef = useRef(false);
  const olderAnchorRef = useRef<{ id: string; top: number } | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState(matchId);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendDenied, setSendDenied] = useState(false);
  type Operation = { id: string; matchId: string; content: string; generation: number };
  const sendOperationRef = useRef<Operation | null>(null);
  const attemptRef = useRef<Operation | null>(null);
  const generation = useRef(0);
  const sendController = useRef<AbortController | null>(null);
  const canSend = native ? !activity.blocked && !sendDenied : isConnected;
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
      attemptRef.current = null;
      sendController.current?.abort();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    },
    [matchId, legacySocket, isUnmatched],
  );
  useLayoutEffect(
    () => () => {
      sendOperationRef.current = null;
      attemptRef.current = null;
      sendController.current?.abort();
    },
    [],
  );

  // Clear marked messages when matchId changes
  useEffect(() => {
    const markedAsRead = markedAsReadRef.current;
    markedAsRead.clear();
  }, [matchId]);

  // Mark a message as read (helper function)
  const markMessageAsRead = useCallback(
    (messageId: string) => {
      if (
        native ||
        !socket ||
        !isConnected ||
        isUnmatched ||
        markedAsReadRef.current.has(messageId)
      )
        return;

      markedAsReadRef.current.add(messageId);
      socket.emit('message:read', { messageId });
    },
    [socket, isConnected, isUnmatched, native],
  );

  // Socket connection and event handlers
  useEffect(() => {
    if (native || !socket || !isConnected || isUnmatched) return;

    let active = true;

    const handleNewMessage = (message: Parameters<ServerToClientEvents['message:new']>[0]) => {
      if (message.matchId === matchId) {
        queryClient.setQueryData<MessagePages>(['messages', matchId], (previous) =>
          addSavedMessages(matchId, previous, [{ ...message, readAt: message.readAt ?? null }]),
        );
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string }) => {
      queryClient.setQueryData<MessagePages>(['messages', matchId], (previous) =>
        readSavedMessage(matchId, previous, data.messageId, data.readAt),
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
  }, [socket, isConnected, matchId, otherUserId, isUnmatched, queryClient, native]);

  useEffect(() => {
    messages.forEach((message) => {
      if (!message.readAt && message.senderId !== currentUserId) markMessageAsRead(message.id);
    });
  }, [messages, currentUserId, markMessageAsRead]);

  const newestMessageId = messages.at(-1)?.id;
  useEffect(() => {
    if (!olderLoadingRef.current) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [newestMessageId]);

  useLayoutEffect(() => {
    if (!olderLoadingRef.current || isFetchingNextPage) return;
    const anchor = olderAnchorRef.current;
    const container = historyRef.current;
    if (anchor && container) {
      const element = [...container.querySelectorAll<HTMLElement>('[data-message-id]')].find(
        (item) => item.dataset.messageId === anchor.id,
      );
      if (element) container.scrollTop += element.getBoundingClientRect().top - anchor.top;
    }
    olderLoadingRef.current = false;
    olderAnchorRef.current = null;
  }, [messages, isFetchingNextPage]);

  useEffect(() => {
    return () => {
      olderLoadingRef.current = false;
      olderAnchorRef.current = null;
    };
  }, [matchId]);

  const loadOlder = () => {
    if (olderLoadingRef.current) return;
    const container = historyRef.current;
    if (container) {
      const top = container.getBoundingClientRect().top;
      const anchor = [...container.querySelectorAll<HTMLElement>('[data-message-id]')].find(
        (item) => item.getBoundingClientRect().bottom > top,
      );
      if (anchor?.dataset.messageId)
        olderAnchorRef.current = {
          id: anchor.dataset.messageId,
          top: anchor.getBoundingClientRect().top,
        };
    }
    olderLoadingRef.current = true;
    void fetchNextPage().catch(() => {});
  };

  const handleInputChange = (value: string) => {
    generation.current++;
    setNewMessage(value);
    if (sendOperationRef.current?.content !== value.trim()) sendOperationRef.current = null;
    setSendError(null);

    if (native) {
      activity.updateTyping(!!value.trim());
      return;
    }

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

    if (!newMessage.trim() || isSending || !canSend || isUnmatched || (!native && !socket)) return;

    const messageContent = newMessage.trim();
    const previous = sendOperationRef.current;
    const operation =
      previous?.matchId === matchId && previous.content === messageContent
        ? { ...previous, generation: generation.current }
        : {
            id: crypto.randomUUID(),
            matchId,
            content: messageContent,
            generation: generation.current,
          };
    sendOperationRef.current = operation;
    attemptRef.current = operation;
    setIsSending(true);
    setSendError(null);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (native) activity.updateTyping(false);
    else socket?.emit('typing:stop', { matchId });

    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      const payload = { matchId, content: messageContent, clientRequestId: operation.id };
      let saved: Message;
      if (native) {
        const controller = new AbortController();
        sendController.current = controller;
        deadline = setTimeout(() => controller.abort(), 8000);
        saved = await sendMessage.mutateAsync({
          ...payload,
          ...expectedChatOwner(owner),
          signal: controller.signal,
        });
        if (controller.signal.aborted) throw new Error('Message response abandoned');
      } else {
        if (!socket) return;
        const result = await socket.timeout(8000).emitWithAck('message:send', payload);
        if (attemptRef.current !== operation) return;
        if (!result.ok) {
          setSendError(result.message);
          return;
        }
        saved = result.message;
      }
      if (attemptRef.current !== operation) return;
      queryClient.setQueryData<MessagePages>(cacheKey, (previousMessages) =>
        addSavedMessages(matchId, previousMessages, [{ ...saved, readAt: saved.readAt ?? null }]),
      );
      if (sendOperationRef.current === operation && generation.current === operation.generation) {
        setNewMessage('');
        sendOperationRef.current = null;
      }
    } catch (error) {
      if (attemptRef.current !== operation) return;
      if (chatAccessDenied(error)) {
        setSendDenied(true);
        void queryClient.invalidateQueries({ queryKey: ['match', matchId] });
        setSendError('Chat access changed. Refresh the page to continue.');
      } else if (error instanceof FetchError && [400, 409].includes(error.status)) {
        setSendError('Message rejected. Review or edit your draft before trying again.');
      } else
        setSendError(
          native
            ? 'Send not confirmed. Your draft is kept. Retry to check.'
            : 'Send not confirmed. Your draft is kept. Retry when connected.',
        );
    } finally {
      if (deadline) clearTimeout(deadline);
      if (attemptRef.current === operation) {
        attemptRef.current = null;
        setIsSending(false);
      }
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
        ref={historyRef}
        className="flex-1 space-y-2 overflow-y-auto p-4"
      >
        {hasNextPage && (
          <div className="text-center">
            {isFetchNextPageError && (
              <p role="alert" className="mb-2 text-sm text-error">
                Could not load older messages. Try again.
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={loadOlder}
              disabled={isFetchingNextPage}
            >
              Load older messages
            </Button>
          </div>
        )}
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
        {(native ? activity.typing : isTyping) && !isUnmatched && (
          <div role="status" aria-label="Typing indicator" className="mb-4 flex justify-start">
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
            {native && realtime.status !== 'connected' && (
              <div role="status" className="mb-2 text-center text-sm text-warning">
                Live updates unavailable. You can still send messages.
                <Button type="button" variant="ghost" onClick={realtime.retry}>
                  Retry live updates
                </Button>
              </div>
            )}
            {native && (activity.blocked || sendDenied) && (
              <div role="alert">
                Chat access changed. Refresh the page to continue.
                <Button type="button" variant="ghost" onClick={() => window.location.reload()}>
                  Refresh chat
                </Button>
              </div>
            )}
            {native && activity.readError && !activity.blocked && (
              <Button type="button" variant="ghost" onClick={activity.retryRead}>
                Retry read receipts
              </Button>
            )}
            {native && activity.typingError && !activity.blocked && (
              <p role="status">Typing updates are unavailable.</p>
            )}
            {!native && !isConnected && (
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
                disabled={isSending || !canSend}
              />
              <Button
                type="submit"
                aria-label={sendError ? 'Retry send' : 'Send message'}
                disabled={!newMessage.trim() || isSending || !canSend}
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
