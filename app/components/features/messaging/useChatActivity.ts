'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  expectedChatOwner,
  markChatRead,
  readChatTyping,
  writeChatTyping,
  chatAccessDenied,
} from '@/lib/client/chat-activity';
import type { ChatOwner } from './activity-input';
import type { Message } from './types';
import { messageQueryKey } from './hooks';
import { readSavedMessage, type MessagePages } from './message-pages';

type TypingSnapshot = Awaited<ReturnType<typeof readChatTyping>>;
function visibilityChanged(callback: () => void) {
  document.addEventListener('visibilitychange', callback);
  return () => document.removeEventListener('visibilitychange', callback);
}

export function useChatActivity(
  matchId: string,
  owner: ChatOwner | undefined,
  leaseId: string | null,
  connected: boolean,
  isUnmatched: boolean,
  messages: Message[],
) {
  const client = useQueryClient();
  const userId = owner?.userId;
  const sessionId = owner?.sessionId;
  const key = useMemo(
    () => messageQueryKey(matchId, userId && sessionId ? { userId, sessionId } : undefined),
    [matchId, userId, sessionId],
  );
  const typingKey = useMemo(
    () => ['typing', matchId, userId, sessionId],
    [matchId, userId, sessionId],
  );
  const [viewId] = useState(() => crypto.randomUUID());
  const sequence = useRef({ value: 0 });
  const writer = useRef<((typing: boolean) => void) | null>(null);
  const [readFailure, setReadFailure] = useState<unknown>(null);
  const [typingFailure, setTypingFailure] = useState<unknown>(null);
  const [readRevision, setReadRevision] = useState(0);
  const visible = useSyncExternalStore(
    visibilityChanged,
    () => document.visibilityState === 'visible',
    () => false,
  );
  const typingQuery = useQuery({
    queryKey: typingKey,
    enabled: !!userId && !!sessionId && !isUnmatched,
    retry: false,
    queryFn: async ({ signal }) => {
      if (!userId || !sessionId) throw new Error('Session changed');
      const result = await readChatTyping(matchId, { userId, sessionId }, signal);
      return result.expiresAt && Date.parse(result.expiresAt) <= Date.now()
        ? { typing: false, expiresAt: null }
        : result;
    },
  });
  const blocked =
    chatAccessDenied(readFailure) ||
    chatAccessDenied(typingFailure) ||
    chatAccessDenied(typingQuery.error);

  useEffect(() => {
    const expiresAt = typingQuery.data?.expiresAt;
    if (!expiresAt) return;
    const timer = setTimeout(
      () =>
        client.setQueryData(typingKey, (previous: TypingSnapshot | undefined) =>
          previous?.expiresAt === expiresAt ? { typing: false, expiresAt: null } : previous,
        ),
      Math.max(0, Math.min(5000, Date.parse(expiresAt) - Date.now())),
    );
    return () => clearTimeout(timer);
  }, [client, typingKey, typingQuery.data]);

  useEffect(() => {
    if (!userId || !sessionId || isUnmatched || blocked || !visible) return;
    const ids = messages
      .filter((message) => message.senderId !== userId && !message.readAt)
      .slice(0, 100)
      .map(({ id }) => id);
    if (!ids.length) return;
    const controller = new AbortController();
    void markChatRead(matchId, { userId, sessionId }, ids, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        client.setQueryData<MessagePages>(key, (previous) =>
          result.receipts.reduce(
            (data, receipt) => readSavedMessage(matchId, data, receipt.id, receipt.readAt),
            previous,
          ),
        );
        setReadFailure(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setReadFailure(error);
      });
    return () => controller.abort();
  }, [
    client,
    key,
    matchId,
    userId,
    sessionId,
    messages,
    isUnmatched,
    blocked,
    visible,
    readRevision,
  ]);

  useEffect(() => {
    if (!userId || !sessionId || !leaseId || !connected || isUnmatched || blocked) return;
    const controller = new AbortController();
    const binding = { ...expectedChatOwner({ userId, sessionId }), leaseId, viewId };
    const counter = sequence.current;
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    let lastStart = 0;
    let wrote = false;
    const send = (typing: boolean) => {
      wrote = true;
      void writeChatTyping(
        matchId,
        { ...binding, typing, sequence: ++counter.value },
        { signal: controller.signal },
      )
        .then(() => {
          if (!controller.signal.aborted) setTypingFailure(null);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) setTypingFailure(error);
        });
    };
    const update = (typing: boolean) => {
      if (stopTimer) clearTimeout(stopTimer);
      if (!typing) {
        send(false);
        return;
      }
      if (Date.now() - lastStart >= 1000) {
        lastStart = Date.now();
        send(true);
      }
      stopTimer = setTimeout(() => send(false), 2000);
    };
    writer.current = update;
    const hidden = () => {
      if (document.visibilityState !== 'visible') update(false);
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      if (writer.current === update) writer.current = null;
      if (stopTimer) clearTimeout(stopTimer);
      document.removeEventListener('visibilitychange', hidden);
      controller.abort();
      if (wrote)
        void writeChatTyping(
          matchId,
          { ...binding, typing: false, sequence: ++counter.value },
          { keepalive: true },
        ).catch(() => {});
    };
  }, [matchId, userId, sessionId, leaseId, viewId, connected, isUnmatched, blocked]);

  const updateTyping = useCallback((typing: boolean) => writer.current?.(typing), []);
  const retryRead = useCallback(() => setReadRevision((value) => value + 1), []);
  return {
    typing: connected && !!typingQuery.data?.typing,
    updateTyping,
    blocked,
    retryRead,
    readError: !!readFailure,
    typingError: !!typingFailure || typingQuery.isError,
  };
}
