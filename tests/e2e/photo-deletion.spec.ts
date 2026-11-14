import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { UTApi } from 'uploadthing/server';
import { getServerSession } from '../../lib/session';
import { deleteProfilePhoto } from '../../lib/server/profile-photo-delete';

test('photo deletion keeps an owned retry reference until storage and database cleanup finish', async ({
  browser,
  baseURL,
  request,
}) => {
  test.setTimeout(90_000);
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  expect(process.env.UPLOADTHING_TOKEN || '').toBe('');
  const db = new PrismaClient();
  const contexts = await Promise.all(
    [242, 243].map((ip) =>
      browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` } }),
    ),
  );
  const emails: string[] = [];
  const people: string[] = [];
  const password = 'SyntheticPhotoDelete23!';
  const trigger = `bondi_e2e_photo_${randomUUID().replaceAll('-', '')}`;
  async function removeFailure() {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "File"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  }
  try {
    for (const [index, name] of ['Alice', 'Bob'].entries()) {
      const email = `bondi-e2e-${randomUUID()}-photo-delete@example.test`;
      emails.push(email);
      const response = await contexts[index].request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: { email, password, name },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
    }
    const files = [];
    for (const userId of people)
      files.push(
        await db.file.create({
          data: {
            userId,
            key: `synthetic-${randomUUID()}`,
            url: 'https://synthetic.example.test/photo.png',
            name: 'synthetic.png',
            size: 128,
            type: 'image/png',
          },
        }),
      );
    const [owned, foreign] = files;
    const path = `/api/profile/photos/${owned.key}`;
    expect((await request.delete(path)).status()).toBe(401);
    expect((await contexts[1].request.delete(path)).status()).toBe(404);
    const missingConfiguration = await contexts[0].request.delete(path);
    expect(missingConfiguration.status()).toBe(503);
    expect((await missingConfiguration.json()).success).not.toBe(true);
    expect(await db.file.findUnique({ where: { id: owned.id } })).toMatchObject({
      key: owned.key,
      userId: people[0],
    });
    await db.session.updateMany({
      where: { userId: people[0] },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await contexts[0].request.delete(path)).status()).toBe(401);
    expect(await db.file.count({ where: { id: owned.id } })).toBe(1);
    const signedIn = await contexts[0].request.post('/api/auth/sign-in/email', {
      headers: { Origin: baseURL! },
      data: { email: emails[0], password },
    });
    expect(signedIn.status()).toBe(200);
    const cookie = (await contexts[0].cookies(baseURL!))
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ');
    const session = await getServerSession(new Headers({ Cookie: cookie }));
    expect(session?.user.id).toBe(people[0]);
    if (!session) throw new Error('Expected an authenticated synthetic owner');

    const objects = new Set(files.map(({ key }) => key));
    let mode: 'negative' | 'error' | 'success' = 'negative';
    let storageRequests = 0;
    const token = Buffer.from(
      JSON.stringify({ apiKey: 'sk_synthetic_test_key', appId: 'synthetic', regions: ['sea1'] }),
    ).toString('base64');
    const provider = new UTApi({
      token,
      logLevel: 'None',
      fetch: async (input, init) => {
        const storageRequest = new Request(input, init);
        expect(new URL(storageRequest.url).pathname).toBe('/v6/deleteFiles');
        const payload = await storageRequest.json();
        expect(payload.fileKeys).toEqual([owned.key]);
        storageRequests++;
        if (mode === 'negative') return Response.json({ success: false, deletedCount: 0 });
        if (mode === 'error') return Response.json({ error: 'synthetic refusal' }, { status: 400 });
        return Response.json({ success: true, deletedCount: objects.delete(owned.key) ? 1 : 0 });
      },
    });
    const deleteFromStorage = (key: string) => provider.deleteFiles(key);
    await expect(deleteProfilePhoto(people[1], owned.key, deleteFromStorage)).rejects.toMatchObject(
      { statusCode: 404 },
    );
    expect(storageRequests).toBe(0);
    for (const failure of ['negative', 'error'] as const) {
      mode = failure;
      await expect(
        deleteProfilePhoto(session.user.id, owned.key, deleteFromStorage),
      ).rejects.toMatchObject({ statusCode: 503 });
      expect(await db.file.count({ where: { id: owned.id } })).toBe(1);
      expect(objects.has(owned.key)).toBe(true);
    }
    expect(owned.id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."id" = '${owned.id}' THEN RAISE EXCEPTION 'synthetic photo cleanup failure'; END IF; RETURN OLD; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE DELETE ON "File" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    mode = 'success';
    await expect(
      deleteProfilePhoto(session.user.id, owned.key, deleteFromStorage),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(objects.has(owned.key)).toBe(false);
    expect(await db.file.findUnique({ where: { id: owned.id } })).toMatchObject({
      key: owned.key,
      userId: people[0],
    });
    await removeFailure();
    await deleteProfilePhoto(session.user.id, owned.key, deleteFromStorage);
    expect(await db.file.count({ where: { id: owned.id } })).toBe(0);
    expect(objects.has(owned.key)).toBe(false);
    expect(await db.file.count({ where: { id: foreign.id } })).toBe(1);
    expect(objects.has(foreign.key)).toBe(true);
    expect(storageRequests).toBe(4);
  } finally {
    try {
      await removeFailure();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      try {
        await db.user.deleteMany({ where: { email: { in: emails } } });
      } finally {
        await db.$disconnect();
      }
    }
  }
});
