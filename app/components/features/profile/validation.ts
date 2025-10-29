import { z } from 'zod';

export const profileEditSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be at most 50 characters'),
  age: z
    .number()
    .min(18, 'You must be at least 18 years old')
    .max(100, 'Age must be at most 100'),
  bio: z
    .string()
    .min(10, 'Bio must be at least 10 characters')
    .max(500, 'Bio must be at most 500 characters'),
  gender: z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'OTHER']),
  location: z.string().optional(),
  interests: z.array(z.string()),
  hobbies: z.array(z.string()),
  lookingFor: z.string().optional(),
  relationshipType: z.enum(['CASUAL', 'SERIOUS', 'FRIENDSHIP', 'NOT_SURE']),
  genderPreference: z.enum(['MALE', 'FEMALE', 'EVERYONE']),
});
