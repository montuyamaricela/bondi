import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { importJWK, SignJWT, type JWK } from 'jose';
import { test, expect } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';
import { publishRealtimeHint, signRealtimeCredential } from '../../lib/server/realtime';

type Credential = {
  token: string;
  userId: string;
  sessionId: string;
  leaseId: string;
  topic: string;
  expiresAt: string;
};

test('native private subscriptions enforce session capabilities, signing keys and receive-only hints', async ({
  browser,
  baseURL,
}) => {
  const target = assertTestDatabase();
  if (!target.native) throw new Error('Native Supabase required.');
  const db = new PrismaClient({ log: [] });
  const contexts = await Promise.all(
    [181, 182].map((ip) =>
      browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` } }),
    ),
  );
  const emails: string[] = [];
  const clients: SupabaseClient[] = [];
  const credentials: Credential[] = [];
  const clientFor = (token: string | null) => {
    const client = createClient(target.apiUrl, process.env.SUPABASE_TEST_PUBLIC_KEY!, {
      accessToken: async () => token,
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { timeout: 4000 },
    });
    clients.push(client);
    return client;
  };
  const join = (client: SupabaseClient, topic: string, receive?: () => void) =>
    new Promise<{ channel: RealtimeChannel; status: string }>((resolve) => {
      const channel = client.channel(topic, {
        config: { private: true, broadcast: { ack: true, self: true } },
      });
      channel.on('broadcast', { event: 'changed' }, (frame) => {
        expect(Object.keys(frame.payload)).toHaveLength(0);
        receive?.();
      });
      channel.subscribe((status) => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status))
          resolve({ channel, status });
      });
    });
  try {
    for (const [index, context] of contexts.entries()) {
      const email = `bondi-e2e-${randomUUID()}-realtime@example.test`;
      emails.push(email);
      const signup = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: {
          email,
          name: `Native owner ${index}`,
          password: 'SyntheticRealtime77!password',
        },
      });
      expect(signup.status()).toBe(200);
      const userId = (await signup.json()).user.id;
      const session = await context.request.get('/api/auth/get-session');
      const sessionId = (await session.json()).session.id;
      const response = await context.request.post('/api/realtime/credential', {
        data: { expectedUserId: userId, expectedSessionId: sessionId },
      });
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toBe('no-store');
      credentials.push(await response.json());
    }
    const owner = credentials[0];
    const other = credentials[1];
    expect(owner.userId).not.toMatch(/^[a-f\d]{8}-/);
    expect(Date.parse(owner.expiresAt) - Date.now()).toBeLessThanOrEqual(90_000);
    const anonymous = await browser.newContext();
    try {
      expect(
        (await anonymous.request.post('/api/realtime/credential', { data: {} })).status(),
      ).toBe(401);
    } finally {
      await anonymous.close();
    }
    const wrong = await contexts[0].request.post('/api/realtime/credential', {
      data: { expectedUserId: other.userId, expectedSessionId: other.sessionId },
    });
    expect(wrong.status()).toBe(409);
    const foreignLease = await contexts[0].request.post('/api/realtime/credential', {
      data: {
        expectedUserId: owner.userId,
        expectedSessionId: owner.sessionId,
        leaseId: other.leaseId,
      },
    });
    expect(foreignLease.status()).toBe(409);
    const renewal = await contexts[0].request.post('/api/realtime/credential', {
      data: {
        expectedUserId: owner.userId,
        expectedSessionId: owner.sessionId,
        leaseId: owner.leaseId,
      },
    });
    expect(renewal.status()).toBe(200);
    expect((await renewal.json()).topic === owner.topic).toBe(true);

    let received = 0;
    const connected = await join(clientFor(owner.token), owner.topic, () => {
      received++;
    });
    expect(connected.status).toBe('SUBSCRIBED');
    expect((await join(clientFor(null), owner.topic)).status).not.toBe('SUBSCRIBED');
    expect((await join(clientFor(other.token), owner.topic)).status).not.toBe('SUBSCRIBED');
    await publishRealtimeHint(owner.userId);
    await expect.poll(() => received).toBe(1);

    const keys: JWK[] = JSON.parse(await readFile(process.env.SUPABASE_SIGNING_KEYS_PATH!, 'utf8'));
    const lease = {
      id: owner.leaseId,
      userId: owner.userId,
      sessionId: owner.sessionId,
      expiresAt: new Date(Date.now() + 60_000),
    };
    const overlap = await signRealtimeCredential(lease, 1);
    expect((await join(clientFor(overlap), owner.topic)).status).toBe('SUBSCRIBED');
    const crafted = async (changes: {
      issuer?: string;
      audience?: string;
      kid?: string;
      exp?: number;
    }) =>
      new SignJWT({
        role: 'authenticated',
        bondi_session: owner.sessionId,
        bondi_lease: owner.leaseId,
      })
        .setProtectedHeader({ alg: 'ES256', kid: changes.kid ?? keys[0].kid })
        .setIssuer(changes.issuer ?? 'bondi-realtime')
        .setAudience(changes.audience ?? 'authenticated')
        .setSubject(owner.userId)
        .setIssuedAt()
        .setExpirationTime(changes.exp ?? Math.floor(Date.now() / 1000) + 60)
        .sign(await importJWK({ ...keys[0], key_ops: ['sign'] }, 'ES256'));
    for (const changes of [
      { issuer: 'outsider' },
      { audience: 'outsider' },
      { kid: randomUUID() },
      { exp: Math.floor(Date.now() / 1000) - 60 },
    ]) {
      expect((await join(clientFor(await crafted(changes)), owner.topic)).status).not.toBe(
        'SUBSCRIBED',
      );
    }

    // Native denial may be silent; prove the legitimate recipient sees no forged frame.
    await connected.channel.send({ type: 'broadcast', event: 'changed', payload: {} });
    await connected.channel.track({ forged: true });
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(received).toBe(1);
    expect(Object.keys(connected.channel.presenceState())).toHaveLength(0);
    const policies = await db.$queryRaw<
      Array<{ cmd: string }>
    >`SELECT cmd FROM pg_policies WHERE schemaname = 'realtime' AND policyname = 'bondi_session_receive'`;
    expect(policies).toEqual([{ cmd: 'SELECT' }]);
    const api = await fetch(`${target.apiUrl}/rest/v1/RealtimeLease?select=*&limit=1`, {
      headers: {
        apikey: process.env.SUPABASE_TEST_PUBLIC_KEY!,
        Authorization: `Bearer ${owner.token}`,
      },
    });
    expect([401, 403, 404]).toContain(api.status);

    await db.session.update({ where: { id: owner.sessionId }, data: { expiresAt: new Date(0) } });
    expect((await contexts[0].request.get('/api/profile')).status()).toBe(401);
    expect(
      (
        await contexts[0].request.post('/api/realtime/credential', {
          data: { expectedUserId: owner.userId, expectedSessionId: owner.sessionId },
        })
      ).status(),
    ).toBe(401);
    // Leave the malicious connection open: dispatcher still selects live DB sessions.
    await publishRealtimeHint(owner.userId);
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(received).toBe(1);
    expect((await join(clientFor(owner.token), owner.topic)).status).not.toBe('SUBSCRIBED');
  } finally {
    await Promise.allSettled(
      clients.map(async (client) => {
        await client.removeAllChannels();
        client.realtime.disconnect();
      }),
    );
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});
