import { randomUUID } from 'node:crypto';
import { PrismaClient, type Gender, type GenderPreference } from '@prisma/client';
import { expect, test, type Browser } from '@playwright/test';

async function discoveryFixture(browser: Browser, baseURL: string, ip: number) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-discovery`;
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` },
  });
  const close = async () => {
    await context.close();
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    const response = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL },
      data: {
        email: `${prefix}@example.test`,
        name: 'Discovery viewer',
        password: 'SyntheticDiscovery29!',
      },
    });
    expect(response.status()).toBe(200);
    const viewer = (await response.json()).user.id;
    const profile = {
      age: 97,
      bio: 'Synthetic discovery fixture.',
      interests: ['Music'],
      hobbies: ['Reading'],
    };
    await db.profile.create({
      data: {
        ...profile,
        userId: viewer,
        name: 'Discovery viewer',
        gender: 'MALE',
        genderPreference: 'FEMALE',
        locationMode: 'DEVICE',
        showDistance: true,
        latitude: 0,
        longitude: 0,
      },
    });
    let sequence = 0;
    const candidate = async (
      options: {
        gender?: Gender;
        genderPreference?: GenderPreference;
        age?: number;
        latitude?: number | null;
        longitude?: number | null;
        showDistance?: boolean;
      } = {},
    ) => {
      const id = `${prefix}-${String(sequence++).padStart(4, '0')}`;
      await db.user.create({
        data: {
          id,
          email: `${id}@example.test`,
          name: 'Synthetic candidate',
          emailVerified: false,
        },
      });
      return db.profile.create({
        data: {
          ...profile,
          id,
          userId: id,
          name: 'Synthetic candidate',
          gender: 'FEMALE',
          genderPreference: 'MALE',
          locationMode: options.latitude === null || options.longitude === null ? 'OFF' : 'DEVICE',
          showDistance: options.latitude !== null && options.longitude !== null,
          latitude: 0,
          longitude: 0,
          ...options,
        },
      });
    };
    return { db, context, viewer, candidate, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('discovery ranks eligible candidates beyond fifty, honors mutual preferences and keeps coordinates private', async ({
  browser,
  baseURL,
}) => {
  const fixture = await discoveryFixture(browser, baseURL!, 204);
  try {
    const { db, context, viewer, candidate } = fixture;
    const far = [];
    for (let index = 0; index < 50; index++)
      far.push(await candidate({ latitude: 0, longitude: 30 }));
    const fiftyFirst = await candidate();
    const feed = async (suffix = '&distance=1') => {
      const response = await context.request.get(`/api/discover?minAge=97&maxAge=97${suffix}`);
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect((await feed()).map((profile: { userId: string }) => profile.userId)).toContain(
      fiftyFirst.userId,
    );
    for (let index = 0; index < 50; index++)
      far.push(await candidate({ latitude: 0, longitude: 30 }));
    const laterBatch = await candidate();
    const hidden = await candidate({ showDistance: false });
    const unknown = await candidate({ latitude: null, longitude: null });
    const rejecting = await candidate({ genderPreference: 'FEMALE' });
    const wrongGender = await candidate({ gender: 'MALE' });
    const handled = await candidate();
    const matched = await candidate();
    await db.like.create({
      data: { userId: viewer, targetUserId: handled.userId, action: 'PASS' },
    });
    await db.match.create({ data: { user1Id: matched.userId, user2Id: viewer } });
    const nearby = await feed();
    expect(nearby.map((profile: { userId: string }) => profile.userId)).toEqual([
      fiftyFirst.userId,
      laterBatch.userId,
      hidden.userId,
    ]);
    expect(nearby[0].distance).toBe(0);
    expect(nearby[1].distance).toBe(0);
    expect(nearby[2]).not.toHaveProperty('distance');
    for (const profile of nearby) {
      expect(profile).not.toHaveProperty('latitude');
      expect(profile).not.toHaveProperty('longitude');
      expect(profile).not.toHaveProperty('user');
      expect(profile).not.toHaveProperty('email');
    }
    await db.profile.updateMany({
      where: { userId: { in: far.map((profile) => profile.userId) } },
      data: { interests: [], hobbies: [] },
    });
    const general = await feed('');
    expect(
      general.find((profile: { userId: string }) => profile.userId === unknown.userId),
    ).not.toHaveProperty('distance');
    for (const excluded of [rejecting, wrongGender, handled, matched])
      expect(general.map((profile: { userId: string }) => profile.userId)).not.toContain(
        excluded.userId,
      );
    const everyone = await candidate({ genderPreference: 'EVERYONE' });
    for (const gender of ['MALE', 'FEMALE', 'NON_BINARY', 'OTHER'] as const) {
      await db.profile.update({
        where: { userId: viewer },
        data: { gender, genderPreference: 'EVERYONE' },
      });
      const result = await feed();
      expect(result.map((profile: { userId: string }) => profile.userId)).toContain(
        everyone.userId,
      );
      if (gender === 'MALE')
        expect(result.map((profile: { userId: string }) => profile.userId)).toContain(
          fiftyFirst.userId,
        );
      else
        expect(result.map((profile: { userId: string }) => profile.userId)).not.toContain(
          fiftyFirst.userId,
        );
      if (gender === 'FEMALE')
        expect(result.map((profile: { userId: string }) => profile.userId)).toContain(
          rejecting.userId,
        );
    }
  } finally {
    await fixture.close();
  }
});

test('discovery rejects invalid filters, applies partial age bounds and reports required location', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixture = await discoveryFixture(browser, baseURL!, 205);
  try {
    const { db, context, viewer, candidate } = fixture;
    for (const query of [
      'minAge=nope&maxAge=100',
      'minAge=17',
      'maxAge=101',
      'minAge=98&maxAge=97',
      'minAge=18.5',
      'distance=NaN',
      'distance=Infinity',
      'distance=0',
      'distance=501',
      'distance=1.5',
      'minAge=',
      'maxAge=',
      'distance=',
      'minAge=20x',
      'minAge=18&minAge=99',
    ]) {
      const response = await context.request.get(`/api/discover?${query}`);
      expect(response.status(), query).toBe(400);
      const body = await response.json();
      expect(body).toMatchObject({ code: 'INVALID_FILTERS' });
      expect(JSON.stringify(body)).not.toContain('Prisma');
    }
    const older = await candidate({ age: 99 });
    const younger = await candidate({ age: 19 });
    const minOnly = await context.request.get('/api/discover?minAge=98');
    expect(minOnly.status()).toBe(200);
    expect((await minOnly.json()).map((profile: { userId: string }) => profile.userId)).toContain(
      older.userId,
    );
    const maxOnly = await context.request.get('/api/discover?maxAge=20');
    expect(maxOnly.status()).toBe(200);
    const young = (await maxOnly.json()).map((profile: { userId: string }) => profile.userId);
    expect(young).toContain(younger.userId);
    expect(young).not.toContain(older.userId);
    expect((await request.get('/api/discover')).status()).toBe(401);
    await db.profile.update({
      where: { userId: viewer },
      data: { locationMode: 'OFF', showDistance: false, latitude: null, longitude: null },
    });
    const missing = await context.request.get('/api/discover?distance=10');
    expect(missing.status()).toBe(422);
    expect(await missing.json()).toMatchObject({ code: 'LOCATION_REQUIRED' });
    expect((await context.request.get('/api/discover')).status()).toBe(200);
    await db.profile.delete({ where: { userId: viewer } });
    expect((await context.request.get('/api/discover')).status()).toBe(404);
    await db.session.updateMany({
      where: { userId: viewer },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect((await context.request.get('/api/discover')).status()).toBe(401);
  } finally {
    await fixture.close();
  }
});

test('a distance filter without saved location offers settings and a usable remove-filter action', async ({
  browser,
  baseURL,
}) => {
  const fixture = await discoveryFixture(browser, baseURL!, 206);
  try {
    const { db, context, viewer } = fixture;
    await db.profile.update({
      where: { userId: viewer },
      data: { locationMode: 'OFF', showDistance: false, latitude: null, longitude: null },
    });
    const page = await context.newPage();
    await page.goto('/discover');
    await page.getByRole('button', { name: 'Filters', exact: true }).click();
    await page.getByRole('slider').nth(2).press('Home');
    await page.getByRole('button', { name: 'Apply Filters', exact: true }).click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Enable device location or select an available city' }),
    ).toContainText('Enable device location or select an available city');
    await expect(
      page.getByRole('link', { name: 'Location settings', exact: true }),
    ).toHaveAttribute('href', '/settings');
    await page.getByRole('button', { name: 'Remove distance filter', exact: true }).click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Enable device location or select an available city' }),
    ).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});
