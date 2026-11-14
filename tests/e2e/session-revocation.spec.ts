import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { getCookies } from 'better-auth/cookies';
import { expect, test } from '@playwright/test';
import { auth } from '../../lib/auth';

test.use({ extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.42' } });

test('revoked and expired cached sessions fail their next protected read and write', async ({
  request,
  baseURL,
}) => {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const email = `bondi-e2e-${randomUUID()}-revocation@example.test`;
  const password = 'SyntheticRevocationPassword42!';
  const headers = new Headers({ Origin: baseURL!, 'x-forwarded-for': '192.0.2.42' });
  // Issue genuine cookies with the old cache policy, including after the app disables it.
  const cachedIssuer = betterAuth({
    ...auth.options,
    session: {
      ...auth.options.session,
      cookieCache: { enabled: true, maxAge: 604800 },
    },
  });
  const names = getCookies(cachedIssuer.options);
  function cookieHeader(responseHeaders: Headers) {
    const cookies = responseHeaders.getSetCookie();
    expect(cookies.some((value) => value.startsWith(`${names.sessionData.name}=`))).toBe(true);
    return cookies.map((value) => value.split(';', 1)[0]).join('; ');
  }

  try {
    expect((await request.get('/api/profile')).status()).toBe(401);
    expect(
      (await request.patch('/api/profile/privacy', { data: { showDistance: false } })).status(),
    ).toBe(401);
    const registered = await cachedIssuer.api.signUpEmail({
      body: { email, password, name: 'Synthetic Revocation' },
      headers,
      returnHeaders: true,
    });
    const userId = registered.response.user.id;
    await db.profile.create({
      data: {
        userId,
        name: 'Synthetic Revocation',
        age: 28,
        bio: 'A synthetic account used only for session lifecycle verification.',
        gender: 'OTHER',
        interests: ['Music'],
        hobbies: ['Reading'],
        showDistance: true,
      },
    });
    const revokedCookie = cookieHeader(registered.headers);
    expect(
      (await request.get('/api/profile', { headers: { Cookie: revokedCookie } })).status(),
    ).toBe(200);
    expect((await db.session.deleteMany({ where: { userId } })).count).toBe(1);
    // This proves the retained, correctly signed cache still represents a valid identity.
    expect(
      (await cachedIssuer.api.getSession({ headers: new Headers({ Cookie: revokedCookie }) }))?.user
        .id,
    ).toBe(userId);
    expect(
      (await request.get('/api/profile', { headers: { Cookie: revokedCookie } })).status(),
    ).toBe(401);
    expect(
      (
        await request.patch('/api/profile/privacy', {
          headers: { Cookie: revokedCookie },
          data: { showDistance: false },
        })
      ).status(),
    ).toBe(401);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).showDistance).toBe(true);

    const expiring = await cachedIssuer.api.signInEmail({
      body: { email, password },
      headers,
      returnHeaders: true,
    });
    const expiredCookie = cookieHeader(expiring.headers);
    expect(
      (
        await db.session.updateMany({
          where: { userId },
          data: { expiresAt: new Date(Date.now() - 60_000) },
        })
      ).count,
    ).toBe(1);
    expect(
      (await cachedIssuer.api.getSession({ headers: new Headers({ Cookie: expiredCookie }) }))?.user
        .id,
    ).toBe(userId);
    expect(
      (await request.get('/api/profile', { headers: { Cookie: expiredCookie } })).status(),
    ).toBe(401);
    expect(
      (
        await request.patch('/api/profile/privacy', {
          headers: { Cookie: expiredCookie },
          data: { showDistance: false },
        })
      ).status(),
    ).toBe(401);
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).showDistance).toBe(true);

    const valid = await cachedIssuer.api.signInEmail({
      body: { email, password },
      headers,
      returnHeaders: true,
    });
    const validCookie = cookieHeader(valid.headers);
    expect((await request.get('/api/profile', { headers: { Cookie: validCookie } })).status()).toBe(
      200,
    );
    expect(
      (
        await request.patch('/api/profile/privacy', {
          headers: { Cookie: validCookie },
          data: { showDistance: false },
        })
      ).status(),
    ).toBe(200);
    const active = await db.session.findFirstOrThrow({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    const oldExpiry = new Date(Date.now() + 86_400_000);
    const oldUpdate = new Date(Date.now() - 172_800_000);
    await db.session.update({
      where: { id: active.id },
      data: { expiresAt: oldExpiry, updatedAt: oldUpdate },
    });
    const renewal = await request.get('/api/auth/get-session', {
      headers: { Cookie: validCookie },
    });
    expect(renewal.status()).toBe(200);
    expect((await renewal.json()).user.id).toBe(userId);
    const renewed = await db.session.findUniqueOrThrow({ where: { id: active.id } });
    expect(renewed.expiresAt.getTime()).toBeGreaterThan(oldExpiry.getTime());
    expect(renewed.updatedAt.getTime()).toBeGreaterThan(oldUpdate.getTime());
    expect((renewal.headers()['set-cookie'] || '').includes(`${names.sessionToken.name}=`)).toBe(
      true,
    );
    expect((await db.profile.findUniqueOrThrow({ where: { userId } })).showDistance).toBe(false);
  } finally {
    try {
      await db.user.deleteMany({ where: { email } });
    } finally {
      await db.$disconnect();
    }
  }
});
