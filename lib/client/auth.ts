import { useMutation } from "@tanstack/react-query"
import { signUp, signIn } from "@/lib/auth-client"
import type { SignupFormData, LoginFormData } from "@/app/components/features/auth/types"

export function useSignupMutation() {
  return useMutation({
    mutationFn: async (data: Omit<SignupFormData, "confirmPassword">) => {
      const signupResponse = await signUp.email({
        email: data.email,
        password: data.password,
        name: data.name,
      })

      if (signupResponse.error) {
        throw new Error(signupResponse.error.message || "Failed to create account")
      }

      const loginResponse = await signIn.email({
        email: data.email,
        password: data.password,
      })

      if (loginResponse.error) {
        throw new Error(loginResponse.error.message || "Account created but failed to sign in")
      }

      return {
        success: true,
        user: loginResponse.data?.user,
      }
    },
  })
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await signIn.email({
        email: data.email,
        password: data.password,
      })

      if (response.error) {
        throw new Error(response.error.message || "Invalid email or password")
      }

      return {
        success: true,
        user: response.data?.user,
      }
    },
  })
}
