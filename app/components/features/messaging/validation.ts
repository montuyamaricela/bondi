import { z } from 'zod';

export const sendMessageSchema = z.object({
  matchId: z.string().min(1, 'Match ID is required'),
  content: z
    .string()
    .max(5000, 'Message is too long (max 5000 characters)')
    .trim()
    .min(1, 'Message cannot be empty'),
});

export type SendMessageFormData = z.infer<typeof sendMessageSchema>;
