import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { Message, Conversation, SendMessageData } from './types';
import { mergeSavedMessages } from './message-state';
import { shareMessagePages } from './message-pages';
import { uniquePageItems, type CursorPage } from '@/lib/pagination';

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

export function useMessages(matchId: string | null) {
  return useInfiniteQuery({
    queryKey: ['messages', matchId],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get<CursorPage<Message>>(
        `/api/messages?${new URLSearchParams({ matchId: matchId ?? '', ...(pageParam ? { cursor: pageParam } : {}) })}`,
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
    mutationFn: async (data: SendMessageData) => {
      return await api.post<Message>('/api/messages', data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.matchId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
