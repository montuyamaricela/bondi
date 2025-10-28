import { useMutation } from "@tanstack/react-query"
import { api } from "@/lib/fetch-wrapper"
import type { ProfileSetupFormData } from "@/app/components/features/auth/types"

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

export function useProfileSetupMutation() {
  return useMutation({
    mutationFn: async (data: ProfileSetupFormData) => {
      return await api.post<ProfileSetupResponse>("/api/profile/setup", data)
    },
  })
}
