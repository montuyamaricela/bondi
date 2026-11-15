import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  client,
  configuration,
  confirmProject,
  fail,
  MigrationError,
  verifyMarker,
} from './environment';
import { fixture, request, sessions, startQualificationServer } from './runtime';
import { assertWriteFence, saveState, transferState } from './transfer';

async function main() {
  confirmProject(process.argv.slice(2));
  const local = configuration();
  const state = transferState();
  const data = fixture();
  if (state.phase !== 'accepted' || !state.source)
    fail('Native delivery recovery requires a verified accepted target.');
  if (state.deliveryProven)
    fail(
      'Native delivery recovery already completed; preserve its evidence instead of replaying fixture mutations.',
    );
  const target = client(local.targetUrl);
  const source = client(local.sourceUrl);
  const liveClients: SupabaseClient[] = [];
  const issued: Array<{
    cookie: string;
    userId: string;
    sessionId: string;
    leaseId: string;
    closeToken: string;
  }> = [];
  let unexpectedPayload = false;
  let server: Awaited<ReturnType<typeof startQualificationServer>> | undefined;
  try {
    await verifyMarker(target, local, 'target');
    await verifyMarker(source, local, 'source');
    assertWriteFence(local.sourceUrl);
    const pending = await target.messageDelivery.findMany({
      where: { messageId: data.messageId },
      orderBy: { userId: 'asc' },
    });
    if (pending.length !== 2 || pending.some((row) => row.completedAt !== null))
      fail('The original pending intents must remain uncompleted before native recovery.');
    server = await startQualificationServer(local, 'target');
    const hints = [0, 0];
    for (const [index, owner] of sessions().slice(0, 2).entries()) {
      const credentialResponse = await request('/api/realtime/credential', owner.cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedUserId: owner.userId, expectedSessionId: owner.sessionId }),
      });
      if (credentialResponse.status !== 200)
        fail('Migrated session could not obtain a private native capability.');
      const credential = await credentialResponse.json();
      issued.push({ ...owner, leaseId: credential.leaseId, closeToken: credential.closeToken });
      const live = createClient(local.apiUrl, local.publicKey, {
        accessToken: async () => credential.token,
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { timeout: 5000 },
      });
      liveClients.push(live);
      await live.realtime.setAuth(credential.token);
      const subscribed = await new Promise<string>((done) => {
        live
          .channel(credential.topic, { config: { private: true } })
          .on('broadcast', { event: 'changed' }, ({ payload }) => {
            if (
              Object.keys(payload).some((key) => key !== 'id') ||
              ('id' in payload &&
                (typeof payload.id !== 'string' || !/^[a-f0-9-]{36}$/.test(payload.id)))
            ) {
              unexpectedPayload = true;
              return;
            }
            hints[index]++;
          })
          .subscribe((status) => {
            if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status))
              done(status);
          });
      });
      if (subscribed !== 'SUBSCRIBED')
        fail('Migrated session failed to join its actual private native channel.');
    }
    await target.$executeRawUnsafe(`DO $$ DECLARE owned_job RECORD; BEGIN
      FOR owned_job IN SELECT jobid FROM cron.job WHERE jobname IN ('bondi-message-delivery', 'bondi-typing-retention') LOOP
        PERFORM cron.alter_job(owned_job.jobid, active := true);
      END LOOP; END $$`);
    let recovered = false;
    for (let attempt = 0; attempt < 100 && !recovered; attempt++) {
      const rows = await target.messageDelivery.findMany({ where: { messageId: data.messageId } });
      recovered =
        rows.length === 2 &&
        rows.every(
          (row) =>
            row.completedAt !== null &&
            row.attempts === pending.find((old) => old.userId === row.userId)!.attempts + 1,
        ) &&
        hints.every((count) => count > 0);
      if (!recovered)
        await new Promise((done) => {
          setTimeout(done, 100);
        });
    }
    if (!recovered)
      fail(
        'Managed native recovery did not complete both original intents and deliver private hints.',
      );
    if (unexpectedPayload) fail('Native recovery emitted a private or invalid live payload.');
    state.deliveryProven = true;
    saveState(state);
    console.log(
      'Managed native relay recovered both original pending intents with private hints to the two preserved account sessions.',
    );
  } finally {
    for (const live of liveClients) {
      await live.removeAllChannels();
      await live.realtime.disconnect();
    }
    if (server)
      await Promise.allSettled(
        issued.map((item) =>
          request('/api/realtime/credential', item.cookie, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              expectedUserId: item.userId,
              expectedSessionId: item.sessionId,
              leaseId: item.leaseId,
              closeToken: item.closeToken,
            }),
          }),
        ),
      );
    await server?.stop();
    await target.$disconnect();
    await source.$disconnect();
  }
}
void main().catch((error: unknown) => {
  console.error(
    error instanceof MigrationError
      ? error.message
      : 'Native migration delivery qualification failed; private diagnostics omitted.',
  );
  process.exitCode = 1;
});
