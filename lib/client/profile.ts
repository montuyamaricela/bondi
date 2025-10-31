import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"
import type { ProfileSetupFormData } from "@/app/components/features/auth/types"
import type { ProfileResponse } from "@/types/profile"
import type {
  ProfileWithPhotos,
  ProfileEditFormData,
  ProfileUpdateResponse,
  PhotoDeleteResponse,
} from "@/app/components/features/profile/types"

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
    staleTime: 5 * 60 * 1000,
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

export function useProfileWithPhotosQuery(enabled = true) {
  return useQuery({
    queryKey: ['profile', 'with-photos'],
    queryFn: async () => {
      return await api.get<{ profile: ProfileWithPhotos | null }>(
        '/api/profile/with-photos'
      )
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

export function useProfileUpdateMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ProfileEditFormData) => {
      return await api.patch<ProfileUpdateResponse>('/api/profile', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile', 'with-photos'] })
    },
  })
}

export function usePhotoDeleteMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (photoKey: string) => {
      return await api.delete<PhotoDeleteResponse>(
        `/api/profile/photos/${photoKey}`
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      queryClient.invalidateQueries({ queryKey: ['profile', 'with-photos'] })
    },
  })
}

export function useUserProfileQuery(userId: string, enabled = true) {
  return useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      return await api.get<{ profile: ProfileWithPhotos | null }>(
        `/api/profile/${userId}`
      )
    },
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
