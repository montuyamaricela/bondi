import { z } from 'zod';

const labels = (kind: string) =>
  z
    .array(z.string())
    .min(1, `Select at least one ${kind}`)
    .max(10, `Maximum 10 ${kind === 'hobby' ? 'hobbies' : 'interests'} allowed`)
    .refine(
      (values) => values.every((value) => value.trim().length > 0 && value.length <= 100),
      `Each ${kind} must contain 1–100 nonblank characters`,
    );

export const profileFieldsSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  age: z
    .number({ error: 'Please enter your age as a whole number' })
    .int('Age must be a whole number')
    .min(18, 'You must be at least 18 years old')
    .max(100, 'Age must be at most 100'),
  bio: z
    .string()
    .min(10, 'Bio must be at least 10 characters')
    .max(500, 'Bio must be at most 500 characters'),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'], {
    message: 'Please select your gender',
  }),
  location: z.string().optional(),
  interests: labels('interest'),
  hobbies: labels('hobby'),
  lookingFor: z.string().optional(),
  relationshipType: z.enum(['CASUAL', 'SERIOUS', 'FRIENDSHIP', 'NOT_SURE'], {
    message: "Please select what you're looking for",
  }),
  genderPreference: z.enum(['MALE', 'FEMALE', 'EVERYONE'], {
    message: 'Please select your preference',
  }),
});

export const photoOrderSchema = z
  .array(z.string().min(1).max(512))
  .refine((keys) => new Set(keys).size === keys.length, 'Photo keys must be unique');
export type ProfileFields = z.infer<typeof profileFieldsSchema>;
