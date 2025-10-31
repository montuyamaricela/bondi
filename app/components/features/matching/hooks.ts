"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"

interface Match {
  matchId: string
  matchedAt: Date
  user: {
    id: string
    name: string
    age: number | null
    bio: string | null
    image: string
  }
}

interface MatchDetail {
  matchId: string
  matchedAt: Date
  status: "ACTIVE" | "UNMATCHED"
  otherUser: {
    id: string
    name: string
    age: number | null
    image: string | null
  }
}

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async () => {
      return await api.get<Match[]>("/api/matches")
    },
  })
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: async () => {
      return await api.get<MatchDetail>(`/api/matches/${matchId}`)
    },
    enabled: !!matchId,
  })
}

export function useUnmatchMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (matchId: string) => {
      return await api.patch<{ success: boolean; matchId: string }>(
        `/api/matches/${matchId}/unmatch`,
        {}
      )
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["matches"] })
      queryClient.invalidateQueries({ queryKey: ["match", data.matchId] })
      queryClient.invalidateQueries({ queryKey: ["conversations"] })
    },
  })
}
