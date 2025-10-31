import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"
import type { Message, Conversation, SendMessageData } from "./types"

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      return await api.get<Conversation[]>("/api/matches/conversations")
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export function useMessages(matchId: string | null) {
  return useQuery({
    queryKey: ["messages", matchId],
    queryFn: async () => {
      if (!matchId) return []
      return await api.get<Message[]>(`/api/messages?matchId=${matchId}`)
    },
    enabled: !!matchId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: SendMessageData) => {
      return await api.post<Message>("/api/messages", data)
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["messages", variables.matchId] })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
