import { useMutation, useQuery } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"
import type { ProfileSetupFormData } from "@/app/components/features/auth/types"
import type { ProfileResponse } from "@/types/profile"

interface ProfileSetupResponse {
  success: boolean
  error?: string
  profile?: {
    id: string
    name: string
    age: number
    bio: string
    gender: string
  }
}

export function useProfileQuery(enabled = true) {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      return await api.get<ProfileResponse>("/api/profile")
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}

export function useProfileSetupMutation() {
  return useMutation({
    mutationFn: async (data: ProfileSetupFormData) => {
      return await api.post<ProfileSetupResponse>("/api/profile", data)
    },
  })
}
