import { z } from 'zod';
import { loginSchema, signupSchema, profileSetupSchema } from './validation';

export type LoginFormData = z.infer<typeof loginSchema>;
export type SignupFormData = z.infer<typeof signupSchema>;
export type ProfileSetupFormData = z.infer<typeof profileSetupSchema>;

export type ProfileStep = 1 | 2 | 3;

export interface AuthResponse {
  success: boolean;
  error?: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface FormState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export const stepFields: {
  [key: number]: string[];
} = {
  1: ['name', 'age', 'bio', 'gender', 'location', 'profileImage'],
  2: ['interests', 'hobbies'],
  3: ['relationshipType', 'genderPreference', 'lookingFor'],
};

export const getFieldsToValidate = (step: ProfileStep): string[] => {
  return stepFields[step] || [];
};
