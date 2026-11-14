import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { initializeSocket } from '../../lib/socket';
import { connect, joinRooms } from './socket-helpers';

test('concurrent retries persist once and a lost acknowledgement leaves a recoverable browser draft', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  assertTestDatabase();
  const db = new PrismaClient();
  const server = createServer();
  const initializer = initializeSocket(server);
  const clients: Socket[] = [];
  const contexts = await Promise.all(
    [220, 221, 222].map((ip) =>
      browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` } }),
    ),
  );
  const emails: string[] = [];
  const trigger = `bondi_e2e_retry_${randomUUID().replaceAll('-', '')}`;
  async function removeFailure() {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Message"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  }
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    const people = [];
    for (const [index, name] of ['Alice', 'Bob', 'Other'].entries()) {
      const email = `bondi-e2e-${randomUUID()}-retry@example.test`;
      emails.push(email);
      const response = await contexts[index].request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: { email, password: 'SyntheticRetry20!', name },
      });
      expect(response.status()).toBe(200);
      const userId = (await response.json()).user.id;
      await db.profile.create({
        data: {
          userId,
          name,
          age: 28,
          bio: 'Synthetic retry test profile.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
      const tokenResponse = await contexts[index].request.get('/api/socket/token');
      expect(tokenResponse.status()).toBe(200);
      people.push({ userId, token: (await tokenResponse.json()).token });
    }
    const [alice, bob, other] = people;
    const match = await db.match.create({ data: { user1Id: alice.userId, user2Id: bob.userId } });
    const transports: Array<(payload: object) => Promise<{ status: number; id?: string }>> = [
      async (payload) => {
        const response = await contexts[0].request.post('/api/messages', { data: payload });
        return { status: response.status(), id: (await response.json()).id };
      },
    ];
    for (const url of [baseURL!, 'http://127.0.0.1:3101', `http://127.0.0.1:${address.port}`]) {
      async function open(token: string) {
        const client = io(url, {
          auth: { token },
          autoConnect: false,
          reconnection: false,
          transports: ['websocket'],
          extraHeaders: { Origin: baseURL! },
        });
        clients.push(client);
        await connect(client);
        return client;
      }
      const actor = await open(alice.token);
      const peer = await open(bob.token);
      await joinRooms(actor, peer, match.id);
      transports.push(async (payload) => {
        const result = await actor.timeout(5000).emitWithAck('message:send', payload);
        return result.ok
          ? { status: 201, id: result.message.id }
          : { status: result.code === 'CONFLICT' ? 409 : 400 };
      });
    }
    for (const [index, send] of transports.entries()) {
      const clientRequestId = randomUUID();
      const payload = { matchId: match.id, content: `Synthetic retry ${index}`, clientRequestId };
      const results = await Promise.all(Array.from({ length: 8 }, () => send(payload)));
      expect(results.every(({ status }) => status === 201)).toBe(true);
      expect(new Set(results.map(({ id }) => id)).size, `transport ${index} must deduplicate`).toBe(
        1,
      );
      expect(
        await db.message.count({
          where: { matchId: match.id, senderId: alice.userId, clientRequestId },
        }),
      ).toBe(1);
      expect(
        (await send({ ...payload, content: 'Different operation with reused identity' })).status,
      ).toBe(409);
      expect((await send(payload)).id).toBe(results[0].id);
      expect(await db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } })).toBe(
        index + 1,
      );
    }
    const sharedId = randomUUID();
    const secondMatch = await db.match.create({
      data: { user1Id: alice.userId, user2Id: other.userId },
    });
    for (const [context, matchId] of [
      [contexts[0], match.id],
      [contexts[1], match.id],
      [contexts[0], secondMatch.id],
    ] as const) {
      expect(
        (
          await context.request.post('/api/messages', {
            data: { matchId, clientRequestId: sharedId, content: 'Scoped operation' },
          })
        ).status(),
      ).toBe(201);
    }
    expect(await db.message.count({ where: { clientRequestId: sharedId } })).toBe(3);

    const page = await contexts[0].newPage();
    let websocketReady = false;
    let dropped = false;
    let allowReconnect = false;
    let joinProbeAcknowledged = false;
    let probeJoin: (() => void) | undefined;
    const operationIds: string[] = [];
    await page.route('**/socket.io/**', (route) =>
      dropped && !allowReconnect ? route.abort() : route.continue(),
    );
    await page.routeWebSocket('**/socket.io/**', (route) => {
      if (dropped && !allowReconnect) {
        void route.close();
        return;
      }
      const upstream = route.connectToServer();
      probeJoin = () =>
        upstream.send(`42900001${JSON.stringify(['match:join', { matchId: match.id }])}`);
      let messageAckPrefix: string | undefined;
      route.onMessage((data) => {
        const frame = data.toString();
        if (frame === '5') websocketReady = true;
        if (frame.includes('"message:send"')) {
          const packet: unknown = JSON.parse(frame.slice(frame.indexOf('[')));
          if (Array.isArray(packet) && packet[0] === 'message:send' && packet[1]?.clientRequestId) {
            operationIds.push(packet[1].clientRequestId);
            const ackId = frame.slice(2, frame.indexOf('['));
            if (/^\d+$/.test(ackId)) messageAckPrefix = `43${ackId}[`;
          }
        }
        upstream.send(data);
      });
      upstream.onMessage((data) => {
        const frame = data.toString();
        if (frame.startsWith('43900001[')) joinProbeAcknowledged = true;
        // Drop the first saved acknowledgement and its broadcast, then cut the real connection.
        if (
          !dropped &&
          messageAckPrefix &&
          frame.startsWith('42') &&
          frame.includes('"message:new"')
        )
          return;
        // Join acknowledgements pass through; cut only the captured message acknowledgement.
        if (!dropped && messageAckPrefix && frame.startsWith(messageAckPrefix)) {
          dropped = true;
          websocketReady = false;
          void route.close();
          void upstream.close();
          return;
        }
        route.send(data);
      });
    });
    await page.goto(`/messages/${match.id}`);
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
    await expect.poll(() => websocketReady).toBe(true);
    // Exercise a room acknowledgement over WebSocket regardless of initial polling timing.
    probeJoin?.();
    await expect.poll(() => joinProbeAcknowledged).toBe(true);
    expect(dropped).toBe(false);
    const content = 'A recoverable message after the acknowledgement is lost';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(content);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect.poll(() => dropped).toBe(true);
    await expect(page.getByRole('alert', { name: 'Message send error' })).toContainText(
      'not confirmed',
    );
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(content);
    await expect(
      page.getByRole('log', { name: 'Conversation messages' }).getByText(content, { exact: true }),
    ).toHaveCount(0);
    await expect.poll(() => db.message.count({ where: { matchId: match.id, content } })).toBe(1);
    allowReconnect = true;
    const retry = page.getByRole('button', { name: 'Retry send', exact: true });
    await expect(retry).toBeEnabled();
    await expect.poll(() => websocketReady).toBe(true);
    await retry.click();
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
    await expect(
      page.getByRole('log', { name: 'Conversation messages' }).getByText(content, { exact: true }),
    ).toHaveCount(1);
    expect(operationIds).toHaveLength(2);
    expect(operationIds[1]).toBe(operationIds[0]);
    expect(await db.message.count({ where: { matchId: match.id, content } })).toBe(1);
    await expect
      .poll(() => db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }))
      .toBe(7);

    // Keep the match active: ending it now correctly removes the composer.
    // Restrict this real database failure to the generated synthetic match.
    expect(match.id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."matchId" = '${match.id}' THEN RAISE EXCEPTION 'synthetic message write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Message" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const rejectedDraft = 'Keep this draft after a rejected write';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(rejectedDraft);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByRole('alert', { name: 'Message send error' })).toContainText(
      'could not be sent',
    );
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(
      rejectedDraft,
    );
    expect(await db.message.count({ where: { matchId: match.id, content: rejectedDraft } })).toBe(
      0,
    );
    await removeFailure();
    await page.getByRole('button', { name: 'Retry send', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
    expect(await db.message.count({ where: { matchId: match.id, content: rejectedDraft } })).toBe(
      1,
    );
    expect(operationIds[3]).toBe(operationIds[2]);
    await expect
      .poll(() => db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }))
      .toBe(8);
  } finally {
    await removeFailure();
    for (const client of clients) client.disconnect();
    await Promise.all(contexts.map((context) => context.close()));
    await new Promise<void>((resolve) => {
      initializer.close(() => resolve());
    });
    try {
      await db.match.deleteMany({
        where: { OR: [{ user1: { email: { in: emails } } }, { user2: { email: { in: emails } } }] },
      });
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});
