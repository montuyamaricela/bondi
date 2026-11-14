import { z } from 'zod';

export type PresenceStatus = { visible: boolean; online: boolean };
export type PresenceSnapshot = Record<string, PresenceStatus>;
export const presenceOwnerInput = z.object({
  expectedUserId: z.string().min(1).max(128),
  expectedSessionId: z.string().min(1).max(128),
});
export const presenceWriteInput = presenceOwnerInput
  .extend({
    leaseId: z.string().min(1).max(128),
    sequence: z.number().int().min(1).max(2_147_483_647),
  })
  .strict();
export const presenceSnapshotInput = presenceOwnerInput
  .extend({ userIds: z.array(z.string().min(1).max(128)).max(100) })
  .strict();
