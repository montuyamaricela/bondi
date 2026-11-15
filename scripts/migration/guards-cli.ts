import { resolve } from 'node:path';
import {
  artifactRoot,
  client,
  configuration,
  confirmProject,
  fail,
  MigrationError,
  psql,
  validateConfiguration,
  verifyMarker,
  writePrivateJson,
} from './environment';
import { emptyApplication, sameSnapshot, snapshot } from './snapshot';
import { assertWriteFence, rollbackBeforeWrites, transferState } from './transfer';

async function denied(action: () => unknown | Promise<unknown>, expected: RegExp) {
  try {
    await action();
  } catch (error) {
    if (error instanceof MigrationError && expected.test(error.message)) return;
    throw error;
  }
  fail('A forbidden migration action was unexpectedly accepted.');
}
async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  const state = transferState();
  if (state.phase !== 'accepted' || !state.source)
    fail('Live guard qualification requires the accepted isolated target.');
  const source = client(local.sourceUrl);
  const target = client(local.targetUrl);
  try {
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
    const before = await snapshot(target, local.targetUrl);
    await denied(
      () => validateConfiguration({ ...local, sourceUrl: local.targetUrl }),
      /source\/target identities/,
    );
    await denied(
      () =>
        validateConfiguration({ ...local, targetUrl: local.targetUrl.replace('54332', '54322') }),
      /source\/target identities/,
    );
    await denied(
      () => validateConfiguration({ ...local, apiUrl: 'http://127.0.0.1:54321' }),
      /unapproved project\/API/,
    );
    await denied(
      () =>
        validateConfiguration({
          ...local,
          targetUrl: local.targetUrl.replace('127.0.0.1', 'unapproved.supabase.co'),
        }),
      /loopback PostgreSQL/,
    );
    const wrongNonce = `${local.nonce.startsWith('a') ? 'b' : 'a'}${local.nonce.slice(1)}`;
    await denied(
      () => verifyMarker(target, { ...local, nonce: wrongNonce }, 'target'),
      /actual database\/project\/marker\/version/,
    );
    await denied(
      () => verifyMarker(source, local, 'target'),
      /actual database\/project\/marker\/version/,
    );
    await denied(() => emptyApplication(target), /destination is populated/);
    await denied(() => rollbackBeforeWrites(), /Rollback is refused after target writes/);
    assertWriteFence(local.sourceUrl);
    if (psql(local.targetUrl, 'SHOW default_transaction_read_only').trim() !== 'off')
      fail('Accepted target writer was unexpectedly disabled.');
    if (
      !sameSnapshot(before, await snapshot(target, local.targetUrl)) ||
      !sameSnapshot(state.source, await snapshot(source, local.sourceUrl))
    )
      fail('Rejected migration actions changed application rows.');
    await verifyMarker(source, local, 'source');
    await verifyMarker(target, local, 'target');
    writePrivateJson(resolve(artifactRoot, 'guard-checks.json'), {
      runId: local.runId,
      rejectedActions: 8,
      applicationDataUnchanged: true,
      soleTargetWriter: true,
    });
    console.log(
      'Eight live/pure target guards passed, including actual wrong markers, populated-target refusal and post-write rollback refusal; both datasets unchanged.',
    );
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Live migration guard qualification failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
