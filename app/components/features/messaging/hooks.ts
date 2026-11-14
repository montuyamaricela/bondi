import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import type { Message, Conversation, SendMessageData } from './types';
import { mergeSavedMessages } from './message-state';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      return await api.get<Conversation[]>('/api/matches/conversations');
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function useMessages(matchId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['messages', matchId],
    queryFn: async () => {
      if (!matchId) return [];
      const history = await api.get<Message[]>(`/api/messages?matchId=${matchId}`);
      // Live events received during this request must survive its older snapshot.
      return mergeSavedMessages(
        matchId,
        queryClient.getQueryData<Message[]>(['messages', matchId]) ?? [],
        history,
      );
    },
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
