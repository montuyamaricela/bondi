import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';
import { verifyDatabaseSafety } from '../helpers/database-setup';

test('a native database marker rejects a different prepared environment before fixture writes', async () => {
  const target = assertTestDatabase();
  expect(target.native).toBe(true);
  if (!target.native) throw new Error('Native test environment required.');
  await verifyDatabaseSafety(process.env);
  const wrong = (target.marker[0] === '0' ? '1' : '0') + target.marker.slice(1);
  await expect(verifyDatabaseSafety({ ...process.env, BONDI_TEST_MARKER: wrong })).rejects.toThrow(
    'Native test safety verification failed',
  );
});

test('native anon and authenticated Data API roles cannot access private application data', async ({
  browser,
  baseURL,
}) => {
  const target = assertTestDatabase();
  if (!target.native) throw new Error('Native test environment required.');
  const publicKey = process.env.SUPABASE_TEST_PUBLIC_KEY!;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY!;
  const suffix = randomUUID();
  const email = `bondi-e2e-${suffix}-native@example.test`;
  const db = new PrismaClient({ log: [] });
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.175' },
  });
  let nativeUserId: string | undefined;
  const temporaryTable = `bondi_native_default_${suffix.replaceAll('-', '')}`;
  let tableCreated = false;
  // Node fetch keeps privileged test API keys outside Playwright network traces.
  const nativeFetch = (
    path: string,
    options: { method?: string; body?: unknown; token?: string; admin?: boolean } = {},
  ) => {
    const key = options.admin ? secretKey : publicKey;
    const token = options.token ?? (key.startsWith('eyJ') ? key : undefined);
    return fetch(`${target.apiUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        apikey: key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  };
  try {
    const signup = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL! },
      data: { name: 'Native policy owner', email, password: `SyntheticNative76!${suffix}` },
    });
    expect(signup.status()).toBe(200);
    const userId = (await signup.json()).user.id;
    expect(
      (
        await context.request.post('/api/profile', {
          data: {
            name: 'Native policy owner',
            age: 28,
            bio: 'Synthetic native database permission fixture.',
            gender: 'OTHER',
            interests: ['Music'],
            hobbies: ['Reading'],
            relationshipType: 'FRIENDSHIP',
            genderPreference: 'EVERYONE',
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await context.request.patch('/api/profile/location', {
          data: {
            action: 'DEVICE',
            expectedUserId: userId,
            expectedRevision: 0,
            latitude: 0,
            longitude: 0,
          },
        })
      ).status(),
    ).toBe(200);
    const stored = await db.profile.findUniqueOrThrow({ where: { userId } });
    expect(stored.locationMode).toBe('DEVICE');
    const own = await context.request.get('/api/profile');
    expect(own.status()).toBe(200);
    const safe = (await own.json()).profile;
    expect(safe.userId).toBe(userId);
    expect(safe).not.toHaveProperty('latitude');
    expect(safe).not.toHaveProperty('longitude');

    const nativeSignup = await nativeFetch('/auth/v1/signup', {
      method: 'POST',
      body: {
        email: `native-role-${suffix}@example.test`,
        password: `SyntheticRole76!${suffix}`,
      },
    });
    expect(nativeSignup.status).toBe(200);
    const nativeSession = await nativeSignup.json();
    expect(typeof nativeSession.access_token).toBe('string');
    nativeUserId = nativeSession.user.id;
    const identity = await nativeFetch('/auth/v1/user', { token: nativeSession.access_token });
    expect(identity.status).toBe(200);
    expect((await identity.json()).id).toBe(nativeUserId);

    const tables = [
      ...Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name),
      '_prisma_migrations',
    ];
    const permissions = await db.$queryRaw<
      Array<{ name: string; secured: boolean; anon: boolean; authenticated: boolean }>
    >`
      SELECT c.relname AS name, c.relrowsecurity AS secured,
        has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon,
        has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname IN (${Prisma.join(tables)})`;
    expect(permissions).toHaveLength(tables.length);
    for (const permission of permissions)
      expect(permission, permission.name).toMatchObject({
        secured: true,
        anon: false,
        authenticated: false,
      });
    for (const table of tables) {
      const path = `/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`;
      expect([401, 403, 404], `anon ${table}`).toContain((await nativeFetch(path)).status);
      expect([403, 404], `authenticated ${table}`).toContain(
        (await nativeFetch(path, { token: nativeSession.access_token })).status,
      );
    }
    const forbiddenWrite = await nativeFetch('/rest/v1/Profile', {
      method: 'POST',
      token: nativeSession.access_token,
      body: { userId },
    });
    expect([403, 404]).toContain(forbiddenWrite.status);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).locationRevision).toBe(1);

    await db.$executeRawUnsafe(`CREATE TABLE "${temporaryTable}" (id INTEGER PRIMARY KEY)`);
    tableCreated = true;
    const defaults = await db.$queryRaw<Array<{ anon: boolean; authenticated: boolean }>>`
      SELECT has_table_privilege('anon', ${`public.${temporaryTable}`}, 'SELECT,INSERT,UPDATE,DELETE') AS anon,
        has_table_privilege('authenticated', ${`public.${temporaryTable}`}, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated`;
    expect(defaults).toEqual([{ anon: false, authenticated: false }]);
  } finally {
    await context.close();
    try {
      if (nativeUserId)
        expect(
          (
            await nativeFetch(`/auth/v1/admin/users/${nativeUserId}`, {
              method: 'DELETE',
              admin: true,
            })
          ).ok,
        ).toBe(true);
    } finally {
      try {
        if (tableCreated) await db.$executeRawUnsafe(`DROP TABLE "${temporaryTable}"`);
        await db.user.deleteMany({ where: { email } });
      } finally {
        await db.$disconnect();
      }
    }
  }
});
