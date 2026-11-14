import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { expect, type APIRequestContext } from '@playwright/test';

export async function privateHintObserver(
  request: APIRequestContext,
  headers: Record<string, string> = {},
) {
  const sessionResponse = await request.get('/api/auth/get-session', { headers });
  expect(sessionResponse.status()).toBe(200);
  const session = await sessionResponse.json();
  const owner = { expectedUserId: session.user.id, expectedSessionId: session.session.id };
  const response = await request.post('/api/realtime/credential', { headers, data: owner });
  expect(response.status()).toBe(200);
  const credential = await response.json();
  const client = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_PUBLIC_KEY!,
    {
      accessToken: async () => credential.token,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { timeout: 4000 },
    },
  );
  await client.realtime.setAuth(credential.token);
  let hints = 0;
  let lastHint: Record<string, unknown> = {};
  let closed = false;
  const callbacks = new Set<() => void>();
  const channel: RealtimeChannel = client.channel(credential.topic, { config: { private: true } });
  const status = await new Promise<string>((resolve) => {
    channel
      .on('broadcast', { event: 'changed' }, ({ payload }) => {
        // Native database Broadcast adds only an opaque hint UUID, never resource data.
        expect(Object.keys(payload).filter((key) => key !== 'id')).toHaveLength(0);
        if ('id' in payload) expect(payload.id).toMatch(/^[a-f0-9-]{36}$/);
        lastHint = payload;
        hints++;
        for (const callback of callbacks) callback();
      })
      .subscribe((value) => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(value)) resolve(value);
      });
  });
  if (status !== 'SUBSCRIBED') {
    await client.removeAllChannels();
    await client.realtime.disconnect();
    throw new Error(`Private hint observer failed: ${status}`);
  }
  return {
    userId: session.user.id,
    sessionId: session.session.id,
    topic: credential.topic,
    leaseId: credential.leaseId,
    get hints() {
      return hints;
    },
    get lastHint() {
      return lastHint;
    },
    onHint(callback: () => void) {
      callbacks.add(callback);
      return () => {
        callbacks.delete(callback);
      };
    },
    async close() {
      if (closed) return;
      closed = true;
      callbacks.clear();
      await client.removeChannel(channel);
      await client.realtime.disconnect();
      await request.delete('/api/realtime/credential', {
        headers,
        data: { ...owner, leaseId: credential.leaseId },
      });
    },
  };
}
