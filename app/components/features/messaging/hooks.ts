import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { Message, Conversation, SendMessageData } from './types';
import { mergeSavedMessages } from './message-state';
import { shareMessagePages } from './message-pages';
import { uniquePageItems, type CursorPage } from '@/lib/pagination';
import type { ChatOwner } from './activity-input';
import { expectedChatOwner } from '@/lib/client/chat-activity';

export function messageQueryKey(matchId: string | null, owner?: ChatOwner) {
  return owner ? ['messages', matchId, owner.userId, owner.sessionId] : ['messages', matchId];
}

export function useConversations(search = '') {
  return useInfiniteQuery({
    queryKey: ['conversations', search],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get<CursorPage<Conversation>>(
        `/api/matches/conversations?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(pageParam ? { cursor: pageParam } : {}) })}`,
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => uniquePageItems(data.pages, (conversation) => conversation.matchId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useMessages(matchId: string | null, owner?: ChatOwner) {
  return useInfiniteQuery({
    queryKey: messageQueryKey(matchId, owner),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get<CursorPage<Message>>(
        `/api/messages?${new URLSearchParams({ matchId: matchId ?? '', ...(owner ? expectedChatOwner(owner) : {}), ...(pageParam ? { cursor: pageParam } : {}) })}`,
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    structuralSharing: (previous, incoming) => shareMessagePages(matchId ?? '', previous, incoming),
    select: (data) =>
      mergeSavedMessages(
        matchId ?? '',
        data.pages.flatMap((page) => page.items),
      ),
    enabled: !!matchId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    retry: false,
    mutationFn: async ({ signal, ...data }: SendMessageData & { signal: AbortSignal }) => {
      return await api.post<Message>('/api/messages', data, { signal });
    },
    onSuccess: (_, variables) => {
      if (variables.signal.aborted) return;
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
