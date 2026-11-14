import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser } from '@playwright/test';

const profile = {
  name: 'Synthetic error owner',
  age: 28,
  bio: 'A synthetic profile for error verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
};

async function fixture(browser: Browser, baseURL: string, ip: number) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const email = `bondi-e2e-${randomUUID()}-errors@example.test`;
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` },
  });
  const close = async () => {
    await context.close();
    try {
      await db.user.deleteMany({ where: { email } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    const signup = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL },
      data: { email, name: profile.name, password: 'SyntheticError33!' },
    });
    expect(signup.status()).toBe(200);
    const userId = (await signup.json()).user.id as string;
    expect((await context.request.post('/api/profile', { data: profile })).status()).toBe(201);
    return { db, context, userId, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('an authenticated database failure is redacted, correlated and retryable without partial writes', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 226);
  const trigger = `bondi_e2e_error_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, context, userId } = owned;
    expect(userId).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${userId}' THEN RAISE EXCEPTION 'SELECT synthetic_secret FROM PrivateSchema /synthetic/server.ts password=synthetic-only'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const payload = { ...profile, name: 'Saved after retry' };
    const failed = await context.request.patch('/api/profile', { data: payload });
    expect(failed.status()).toBe(500);
    const body = await failed.json();
    expect(Object.keys(body).sort()).toEqual(['code', 'error', 'requestId']);
    expect(body).toMatchObject({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR' });
    expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(failed.headers()['x-request-id']).toBe(body.requestId);
    expect(JSON.stringify(body)).not.toMatch(
      /SELECT|synthetic_secret|PrivateSchema|server\.ts|password|prisma|UPDATE|Profile/,
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).name).toBe(profile.name);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).name).toBe(profile.name);
    expect((await request.patch('/api/profile', { data: payload })).status()).toBe(401);
    await removeFailure();
    expect((await context.request.patch('/api/profile', { data: payload })).status()).toBe(200);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).name).toBe(payload.name);
    await db.session.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
    expect((await context.request.patch('/api/profile', { data: payload })).status()).toBe(401);
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('malformed application JSON returns 400 after auth without writes and valid requests still succeed', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 227);
  try {
    const { db, context, userId } = owned;
    const before = await db.profile.findUniqueOrThrow({ where: { userId } });
    const routes = [
      ['POST', '/api/profile'],
      ['PATCH', '/api/profile'],
      ['POST', '/api/discover'],
      ['POST', '/api/messages'],
      ['POST', '/api/users/online-status'],
      ['PATCH', '/api/profile/location'],
      ['PATCH', '/api/profile/privacy'],
      ['PATCH', '/api/notifications'],
    ] as const;
    for (const [method, path] of routes) {
      const options = {
        method,
        headers: { 'Content-Type': 'application/json' },
        data: Buffer.from('{'),
      };
      expect((await request.fetch(path, options)).status(), `anonymous ${path}`).toBe(401);
      const response = await context.request.fetch(path, options);
      expect(response.status(), `${method} ${path}`).toBe(400);
      expect((await response.json()).error).toBe('Invalid JSON');
    }
    expect(await db.profile.findUniqueOrThrow({ where: { userId } })).toEqual(before);
    expect(
      (
        await context.request.patch('/api/profile/privacy', {
          data: { showDistance: false, expectedUserId: userId, expectedRevision: 0 },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await context.request.patch('/api/profile/location', {
          data: {
            action: 'DEVICE',
            expectedUserId: userId,
            expectedRevision: 1,
            latitude: 0,
            longitude: 0,
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await context.request.patch('/api/notifications', { data: { ids: [], isRead: true } })
      ).status(),
    ).toBe(200);
    const presence = await context.request.post('/api/users/online-status', {
      data: { userIds: [] },
    });
    expect(presence.status()).toBe(200);
    expect(await presence.json()).toEqual({});
    const invalid = await context.request.patch('/api/profile/location', {
      data: {
        action: 'DEVICE',
        expectedUserId: userId,
        expectedRevision: 2,
        latitude: 91,
        longitude: 0,
      },
    });
    expect(invalid.status()).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: 'Validation failed',
      details: expect.arrayContaining([expect.objectContaining({ path: 'latitude' })]),
    });
  } finally {
    await owned.close();
  }
});
