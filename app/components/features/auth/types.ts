import { z } from "zod"
import { loginSchema, signupSchema, profileSetupSchema } from "./validation"

export type LoginFormData = z.infer<typeof loginSchema>
export type SignupFormData = z.infer<typeof signupSchema>
export type ProfileSetupFormData = z.infer<typeof profileSetupSchema>

export interface AuthResponse {
  success: boolean
  error?: string
  user?: {
    id: string
    email: string
  }
}

export interface FormState {
  isLoading: boolean
  error: string | null
  success: boolean
}
