import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { auth } from '../../lib/auth';
import { initializeSocket } from '../../lib/socket';
import { uploadRouter } from '../../lib/server/uploadthing';
import { connect, joinRooms } from './socket-helpers';

test('HTTP and all socket owners validate text and resolve owned attachment metadata', async ({
  request,
  baseURL,
}) => {
  test.setTimeout(120_000);
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const server = createServer();
  const initializer = initializeSocket(server);
  const clients: Socket[] = [];
  const emails: string[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    const people = [];
    for (const [index, name] of ['Alice', 'Bob', 'Outsider'].entries()) {
      const email = `bondi-e2e-${randomUUID()}-validation@example.test`;
      emails.push(email);
      const result = await auth.api.signUpEmail({
        body: { email, password: 'SyntheticValidation19!', name },
        headers: new Headers({ Origin: baseURL!, 'x-forwarded-for': `192.0.2.${190 + index}` }),
        returnHeaders: true,
      });
      const userId = result.response.user.id;
      await db.profile.create({
        data: {
          userId,
          name,
          age: 28,
          bio: 'Synthetic validation fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
      const cookie = result.headers
        .getSetCookie()
        .map((value) => value.split(';', 1)[0])
        .join('; ');
      const tokenResponse = await request.get('/api/socket/token', { headers: { Cookie: cookie } });
      expect(tokenResponse.status()).toBe(200);
      people.push({ userId, cookie, token: (await tokenResponse.json()).token });
    }
    const [alice, bob, outsider] = people;
    const match = await db.match.create({ data: { user1Id: alice.userId, user2Id: bob.userId } });
    expect(
      (
        await request.post('/api/messages', { data: { matchId: match.id, content: 'Anonymous' } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/messages', {
          data: '{',
          headers: { Cookie: alice.cookie, 'Content-Type': 'application/json' },
        })
      ).status(),
    ).toBe(400);
    async function socket(url: string, token: string) {
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
    const transports: Array<{
      name: string;
      send: (
        payload: unknown,
        person?: typeof alice,
      ) => Promise<{ status: number; body: Record<string, unknown> }>;
    }> = [
      {
        name: 'HTTP',
        send: async (payload, person = alice) => {
          const response = await request.post('/api/messages', {
            data: payload,
            headers: { Cookie: person.cookie },
          });
          return { status: response.status(), body: await response.json() };
        },
      },
    ];
    for (const url of [baseURL!, 'http://127.0.0.1:3101', `http://127.0.0.1:${address.port}`]) {
      const actor = await socket(url, alice.token);
      const peer = await socket(url, bob.token);
      const nonmember = await socket(url, outsider.token);
      expect(await actor.timeout(5000).emitWithAck('match:join', null)).toEqual({ ok: false });
      expect(
        await actor.timeout(5000).emitWithAck('match:join', { matchId: 'missing-match' }),
      ).toEqual({ ok: false });
      await joinRooms(actor, peer, match.id);
      transports.push({
        name: url,
        send: (payload, person = alice) =>
          new Promise((resolve) => {
            const sender = person.userId === alice.userId ? actor : nonmember;
            const operationId = randomUUID();
            const identified =
              payload && typeof payload === 'object' && !Array.isArray(payload)
                ? { clientRequestId: operationId, ...payload }
                : payload;
            const saved = (message: Record<string, unknown>) => {
              if (message.clientRequestId !== operationId) return;
              cleanup();
              resolve({ status: 201, body: message });
            };
            const rejected = (error: Record<string, unknown>) => {
              cleanup();
              resolve({ status: error.code === 'FORBIDDEN' ? 403 : 400, body: error });
            };
            const cleanup = () => {
              sender.off('message:new', saved);
              sender.off('message:error', rejected);
            };
            sender.on('message:new', saved).once('message:error', rejected);
            sender.emit('message:send', identified);
          }),
      });
    }
    for (const transport of [...transports.slice(1), transports[0]]) {
      const before = await db.message.count({ where: { matchId: match.id } });
      for (const payload of [
        { matchId: match.id, content: '   ' },
        null,
        [],
        { matchId: match.id, content: 'x'.repeat(5001) },
        { matchId: {}, content: 'text' },
        { matchId: match.id, content: 42 },
        { matchId: match.id, content: 'text', file: {} },
      ]) {
        const result = await transport.send(payload);
        expect(result.status, `${transport.name} malformed payload`).toBe(400);
      }
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(before);
      const result = await transport.send({ matchId: match.id, content: '  Trimmed text  ' });
      expect(result.status).toBe(201);
      expect(result.body.content).toBe('Trimmed text');
      const boundary = await transport.send({ matchId: match.id, content: 'x'.repeat(5000) });
      expect(boundary.status).toBe(201);
      expect(boundary.body.content).toBe('x'.repeat(5000));
      const forbidden = await transport.send(
        { matchId: match.id, content: 'Nonmember write' },
        outsider,
      );
      expect(forbidden.status).toBe(403);
    }

    // Exercise the actual trusted upload-completion callback and its database record.
    const uploaded = {
      name: 'synthetic.png',
      key: `synthetic-${randomUUID()}`,
      url: 'https://synthetic.example.test/original.png',
      ufsUrl: 'https://synthetic.example.test/original.png',
      appUrl: 'https://synthetic.example.test/original.png',
      size: 128,
      type: 'image/png',
      customId: null,
      fileHash: 'synthetic',
    };
    await uploadRouter.messageAttachment.onUploadComplete({
      metadata: { userId: alice.userId },
      file: uploaded,
    });
    const stored = await db.messageAttachment.findUniqueOrThrow({ where: { key: uploaded.key } });
    expect(stored.userId).toBe(alice.userId);
    await uploadRouter.messageAttachment.onUploadComplete({
      metadata: { userId: alice.userId },
      file: uploaded,
    });
    expect(await db.messageAttachment.count({ where: { key: uploaded.key } })).toBe(1);
    const documents = [];
    for (const [type, maxMiB] of [
      ['application/pdf', 16],
      ['video/mp4', 32],
    ] as const) {
      const file = {
        ...uploaded,
        key: `synthetic-${randomUUID()}`,
        type,
        size: maxMiB * 1024 * 1024,
      };
      await uploadRouter.messageAttachment.onUploadComplete({
        metadata: { userId: alice.userId },
        file,
      });
      documents.push(file);
      await expect(
        uploadRouter.messageAttachment.onUploadComplete({
          metadata: { userId: alice.userId },
          file: { ...file, key: `oversized-${randomUUID()}`, size: file.size + 1 },
        }),
      ).rejects.toThrow('Invalid attachment');
    }
    const foreign = await db.messageAttachment.create({
      data: { ...stored, id: undefined, key: `foreign-${randomUUID()}`, userId: bob.userId },
    });
    const unsupported = await db.messageAttachment.create({
      data: {
        ...stored,
        id: undefined,
        key: `unsupported-${randomUUID()}`,
        type: 'application/javascript',
      },
    });
    const oversized = await db.messageAttachment.create({
      data: {
        ...stored,
        id: undefined,
        key: `oversized-${randomUUID()}`,
        size: 8 * 1024 * 1024 + 1,
      },
    });
    for (const transport of [...transports.slice(1), transports[0]]) {
      const before = await db.message.count({ where: { matchId: match.id } });
      for (const key of ['unregistered-key', foreign.key, unsupported.key, oversized.key]) {
        const result = await transport.send({ matchId: match.id, content: '', file: { key } });
        expect([400, 403]).toContain(result.status);
      }
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(before);
      const result = await transport.send({
        matchId: match.id,
        content: '',
        file: {
          key: uploaded.key,
          url: 'https://forged.example.test/payload',
          name: 'forged.exe',
          type: 'application/x-msdownload',
          size: 999,
        },
      });
      expect(result.status).toBe(201);
      expect(result.body).toMatchObject({
        type: 'IMAGE',
        fileKey: uploaded.key,
        fileUrl: uploaded.ufsUrl,
        fileName: uploaded.name,
        fileSize: uploaded.size,
        fileType: uploaded.type,
      });
      expect(
        await db.message.findUniqueOrThrow({ where: { id: String(result.body.id) } }),
      ).toMatchObject({
        content: '',
        senderId: alice.userId,
        fileKey: uploaded.key,
        fileUrl: uploaded.ufsUrl,
      });
      for (const document of documents) {
        const sent = await transport.send({ matchId: match.id, file: { key: document.key } });
        expect(sent.status).toBe(201);
        expect(sent.body).toMatchObject({
          type: 'FILE',
          fileSize: document.size,
          fileType: document.type,
          fileKey: document.key,
        });
      }
      await db.match.update({ where: { id: match.id }, data: { status: 'UNMATCHED' } });
      expect(
        (await transport.send({ matchId: match.id, content: 'Inactive match write' })).status,
      ).toBe(403);
      await db.match.update({ where: { id: match.id }, data: { status: 'ACTIVE' } });
    }
    await expect
      .poll(() => db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }))
      .toBe(20);
  } finally {
    for (const client of clients) client.disconnect();
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
