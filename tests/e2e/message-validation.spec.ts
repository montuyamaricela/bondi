import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { auth } from '../../lib/auth';
import { uploadRouter } from '../../lib/server/uploadthing';

test('HTTP validates text and resolves owned attachment metadata', async ({ request, baseURL }) => {
  test.setTimeout(120_000);
  assertTestDatabase();
  const db = new PrismaClient();
  const emails: string[] = [];
  try {
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
      people.push({ userId, cookie });
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
    const waves = Array.from({ length: 4 }, (_, index) => ({
      name: `HTTP validation wave ${index + 1}`,
      send: async (
        payload: unknown,
        person = alice,
      ): Promise<{ status: number; body: Record<string, unknown> }> => {
        const response = await request.post('/api/messages', {
          data: payload,
          headers: { Cookie: person.cookie },
        });
        return { status: response.status(), body: await response.json() };
      },
    }));
    for (const wave of waves) {
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
        const result = await wave.send(payload);
        expect(result.status, `${wave.name} malformed payload`).toBe(400);
      }
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(before);
      const result = await wave.send({ matchId: match.id, content: '  Trimmed text  ' });
      expect(result.status).toBe(201);
      expect(result.body.content).toBe('Trimmed text');
      const boundary = await wave.send({ matchId: match.id, content: 'x'.repeat(5000) });
      expect(boundary.status).toBe(201);
      expect(boundary.body.content).toBe('x'.repeat(5000));
      const forbidden = await wave.send(
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
    for (const wave of waves) {
      const before = await db.message.count({ where: { matchId: match.id } });
      for (const key of ['unregistered-key', foreign.key, unsupported.key, oversized.key]) {
        const result = await wave.send({ matchId: match.id, content: '', file: { key } });
        expect([400, 403]).toContain(result.status);
      }
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(before);
      const result = await wave.send({
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
        const sent = await wave.send({ matchId: match.id, file: { key: document.key } });
        expect(sent.status).toBe(201);
        expect(sent.body).toMatchObject({
          type: 'FILE',
          fileSize: document.size,
          fileType: document.type,
          fileKey: document.key,
        });
      }
      await db.match.update({ where: { id: match.id }, data: { status: 'UNMATCHED' } });
      expect((await wave.send({ matchId: match.id, content: 'Inactive match write' })).status).toBe(
        403,
      );
      await db.match.update({ where: { id: match.id }, data: { status: 'ACTIVE' } });
    }
    await expect
      .poll(() => db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }))
      .toBe(20);
  } finally {
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
