import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
})

export const signupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

export const profileSetupSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  age: z
    .number()
    .min(18, "You must be at least 18 years old")
    .max(100, "Please enter a valid age"),
  bio: z
    .string()
    .min(10, "Bio must be at least 10 characters")
    .max(500, "Bio must be less than 500 characters"),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "OTHER"], {
    message: "Please select your gender",
  }),
  location: z.string().optional(),
  interests: z.array(z.string()).min(1, "Select at least one interest").max(10, "Maximum 10 interests allowed"),
  hobbies: z.array(z.string()).min(1, "Select at least one hobby").max(10, "Maximum 10 hobbies allowed"),
  lookingFor: z.string().optional(),
  relationshipType: z.enum(["CASUAL", "SERIOUS", "FRIENDSHIP", "NOT_SURE"], {
    message: "Please select what you're looking for",
  }),
  genderPreference: z.enum(["MALE", "FEMALE", "EVERYONE"], {
    message: "Please select your preference",
  }),
  profileImage: z.string().optional(),
})
