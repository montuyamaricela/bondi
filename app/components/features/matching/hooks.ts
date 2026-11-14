'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/fetch-wrapper';
import { uniquePageItems, type CursorPage } from '@/lib/pagination';

interface Match {
  matchId: string;
  matchedAt: Date;
  user: {
    id: string;
    name: string;
    age: number | null;
    bio: string | null;
    interests: string[];
    image: string;
  };
}

export interface MatchDetail {
  matchId: string;
  matchedAt: Date;
  status: 'ACTIVE' | 'UNMATCHED';
  otherUser: {
    id: string;
    name: string;
    age: number | null;
    image: string | null;
    showOnlineStatus: boolean;
  };
}

interface LikedByUser {
  id: string | null;
  userId: string;
  name: string;
  age: number | null;
  bio: string | null;
  gender: string | null;
  location: string | null;
  interests: string[];
  hobbies: string[];
  lookingFor: string | null;
  relationshipType: string | null;
  photos: {
    id: string;
    url: string;
    key: string;
  }[];
  likedAt: Date;
}

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      return await api.get<Match[]>('/api/matches');
    },
  });
}

export function useMatch(matchId: string) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: async () => {
      return await api.get<MatchDetail>(`/api/matches/${matchId}`);
    },
    enabled: !!matchId,
  });
}

export function useUnmatchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (matchId: string) => {
      return await api.patch<{ success: boolean; matchId: string }>(
        `/api/matches/${matchId}/unmatch`,
        {},
      );
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['match', data.matchId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useReceivedLikes() {
  return useInfiniteQuery({
    queryKey: ['receivedLikes'],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api.get<CursorPage<LikedByUser>>(
        `/api/likes/received${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        { signal },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => uniquePageItems(data.pages, (user) => user.userId),
  });
}
