import { useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { CursorPage } from '@/lib/pagination';
import { api, FetchError } from '@/lib/fetch-wrapper';
import type {
  DiscoverableProfile,
  LikeActionRequest,
  LikeActionResponse,
  DiscoverFilters,
} from '@/app/components/features/discover/types';

export function useDiscoverProfiles(filters: DiscoverFilters) {
  const queryParams = new URLSearchParams();

  if (filters.minAge !== undefined) {
    queryParams.append('minAge', filters.minAge.toString());
  }
  if (filters.maxAge !== undefined) {
    queryParams.append('maxAge', filters.maxAge.toString());
  }
  if (filters.distance !== undefined) {
    queryParams.append('distance', filters.distance.toString());
  }

  return useQuery({
    queryKey: ['discover-profiles', filters],
    queryFn: async ({ signal }) => {
      const url = `/api/discover${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return await api.get<DiscoverableProfile[]>(url, { signal });
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: 'always',
    retry: (failureCount, error) =>
      error instanceof FetchError && error.status >= 400 && error.status < 500
        ? false
        : failureCount < 3,
  });
}

export function useLikeActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: LikeActionRequest) => {
      return await api.post<LikeActionResponse>('/api/discover', data);
    },
    onSuccess: async (_data, { targetUserId }) => {
      // Discard older snapshots before removing a confirmed action from every loaded page.
      await queryClient.cancelQueries({ queryKey: ['receivedLikes'] });
      queryClient.setQueriesData<InfiniteData<CursorPage<{ userId: string }>, string | null>>(
        { queryKey: ['receivedLikes'] },
        (previous) =>
          previous
            ? {
                ...previous,
                pages: previous.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((user) => user.userId !== targetUserId),
                })),
              }
            : previous,
      );
      queryClient.invalidateQueries({ queryKey: ['discover-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['receivedLikes'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
