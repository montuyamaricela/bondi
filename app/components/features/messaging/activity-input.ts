import { z } from 'zod';

const id = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => value.trim().length > 0);

export const chatOwnerInput = z.object({ expectedUserId: id, expectedSessionId: id });
export const readMessagesInput = chatOwnerInput
  .extend({ ids: z.array(id).min(1).max(100) })
  .strict();
export const typingInput = chatOwnerInput
  .extend({
    leaseId: id,
    viewId: z.uuid(),
    sequence: z.number().int().min(1).max(2147483647),
    typing: z.boolean(),
  })
  .strict();

export type ChatOwner = { userId: string; sessionId: string };
export type TypingInput = z.infer<typeof typingInput>;
