import { z } from "zod"

export const likeActionSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
  action: z.enum(["LIKE", "PASS"]),
})

export const discoverFiltersSchema = z.object({
  minAge: z.number().int().min(18).max(100).optional(),
  maxAge: z.number().int().min(18).max(100).optional(),
  distance: z.number().int().min(1).max(500).optional(),
  genderPreference: z.enum(["MALE", "FEMALE", "EVERYONE"]).optional(),
})

export type LikeActionFormData = z.infer<typeof likeActionSchema>
export type DiscoverFiltersFormData = z.infer<typeof discoverFiltersSchema>
