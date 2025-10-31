import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"
import type {
  DiscoverableProfile,
  LikeActionRequest,
  LikeActionResponse,
  DiscoverFilters,
} from "@/app/components/features/discover/types"

export function useDiscoverProfiles(filters: DiscoverFilters) {
  const queryParams = new URLSearchParams()

  if (filters.minAge !== undefined) {
    queryParams.append("minAge", filters.minAge.toString())
  }
  if (filters.maxAge !== undefined) {
    queryParams.append("maxAge", filters.maxAge.toString())
  }
  if (filters.distance !== undefined) {
    queryParams.append("distance", filters.distance.toString())
  }
  if (filters.genderPreference !== undefined) {
    queryParams.append("genderPreference", filters.genderPreference)
  }

  return useQuery({
    queryKey: ["discover-profiles", filters],
    queryFn: async () => {
      const url = `/api/discover${queryParams.toString() ? `?${queryParams.toString()}` : ""}`
      return await api.get<DiscoverableProfile[]>(url)
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useLikeActionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: LikeActionRequest) => {
      return await api.post<LikeActionResponse>("/api/discover", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discover-profiles"] })
      queryClient.invalidateQueries({ queryKey: ["receivedLikes"] })
      queryClient.invalidateQueries({ queryKey: ["matches"] })
    },
  })
}
