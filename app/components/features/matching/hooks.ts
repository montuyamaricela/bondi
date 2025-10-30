"use client"

import { useQuery } from "@tanstack/react-query"
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
