import type { Prisma } from '@prisma/client';

export async function requireMessageTransport(transaction: Prisma.TransactionClient) {
  const [installed] = await transaction.$queryRaw<Array<{ native: boolean }>>`
    SELECT to_regprocedure('bondi_private.dispatch_message_hints(text)') IS NOT NULL AS native`;
  if (!installed.native) throw new Error('Supabase message delivery is not installed.');
}
