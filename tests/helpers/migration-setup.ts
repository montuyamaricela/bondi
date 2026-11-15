import { client, configuration, fail, verifyMarker } from '../../scripts/migration/environment';
import { nativeBoundaries } from '../../scripts/migration/snapshot';
import { assertWriteFence, transferState } from '../../scripts/migration/transfer';
export default async function setup() {
  const local = configuration();
  const state = transferState();
  if (
    state.phase !== 'accepted' ||
    !state.deliveryProven ||
    process.env.DATABASE_URL !== local.targetUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !== local.apiUrl
  )
    fail('Browser qualification runtime does not match the accepted migration target.');
  const source = client(local.sourceUrl);
  const target = client(local.targetUrl);
  try {
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
    assertWriteFence(local.sourceUrl);
    await nativeBoundaries(target);
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}
