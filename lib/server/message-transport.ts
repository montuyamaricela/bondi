import type { Prisma } from '@prisma/client';
import { nativeRealtimeEnabled } from '@/lib/server/env';

export async function nativeMessageTransport(transaction: Prisma.TransactionClient) {
  const [installed] = await transaction.$queryRaw<Array<{ native: boolean }>>`
    SELECT to_regprocedure('bondi_private.dispatch_message_hints(text)') IS NOT NULL AS native`;
  const selected = nativeRealtimeEnabled();
  if (selected !== installed.native)
    throw new Error('Message delivery configuration does not match the database.');
  return selected;
}
