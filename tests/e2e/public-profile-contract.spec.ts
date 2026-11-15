import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';

async function fixture(browser: Browser, baseURL: string, offset: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-public-profile`;
  const cityId = String(900_000_000 + randomInt(90_000_000));
  const contexts: BrowserContext[] = [];
  const people: string[] = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
      await db.locationCity.deleteMany({ where: { id: cityId, sourceVersion: prefix } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (const [index, name] of ['Public viewer', 'Public target'].entries()) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `203.0.113.${offset + index}` },
      });
      contexts.push(context);
      const signup = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email: `${prefix}-${index}@example.test`, name, password: 'SyntheticPublic47!' },
      });
      expect(signup.status()).toBe(200);
      const userId: string = (await signup.json()).user.id;
      people.push(userId);
      expect(
        (
          await context.request.post('/api/profile', {
            data: {
              name,
              age: 28,
              bio: 'Synthetic public profile bio.',
              gender: index === 0 ? 'FEMALE' : 'MALE',
              interests: ['Synthetic music'],
              hobbies: ['Synthetic reading'],
              relationshipType: 'FRIENDSHIP',
              genderPreference: index === 0 ? 'EVERYONE' : 'FEMALE',
            },
          })
        ).status(),
      ).toBe(201);
      await context.route('**/_next/image**', (route) =>
        route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGz8AAAAASUVORK5CYII=',
            'base64',
          ),
        }),
      );
    }
    const key = `synthetic-${randomUUID()}`;
    const photo = await db.file.create({
      data: {
        userId: people[1],
        key,
        url: `https://utfs.io/f/${key}.png`,
        name: 'Synthetic public photo',
        size: 128,
        type: 'image/png',
      },
    });
    await db.locationCity.create({
      data: {
        id: cityId,
        name: 'Synthetic public city',
        region: 'Synthetic region',
        country: 'Synthetic country',
        countryCode: 'PH',
        latitude: 0,
        longitude: 0,
        sourceVersion: prefix,
      },
    });
    return { db, contexts, people, photo, cityId, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('public profile rendering omits a private preference section while owner viewing and editing retain it', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 81);
  try {
    const { contexts, people } = owned;
    const publicPage = await contexts[0].newPage();
    await publicPage.goto(`/profile/${people[1]}`);
    await expect(
      publicPage.getByRole('heading', { name: "Public target's Profile", exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByText('Synthetic public profile bio.', { exact: true }),
    ).toBeVisible();
    await expect(publicPage.getByText('Interested in', { exact: true })).toHaveCount(0);
    await expect(publicPage.getByText('Synthetic music', { exact: true })).toBeVisible();
    await expect(publicPage.getByRole('img', { name: 'Public target', exact: true })).toBeVisible();
    await publicPage.getByRole('button', { name: 'View photo 1', exact: true }).click();
    await expect(publicPage.getByRole('dialog')).toBeVisible();
    await publicPage.keyboard.press('Escape');
    const ownerPage = await contexts[1].newPage();
    await ownerPage.goto('/profile');
    await expect(ownerPage.getByText('Interested in', { exact: true })).toBeVisible();
    await expect(ownerPage.getByText('Women', { exact: true })).toBeVisible();
    await ownerPage.goto('/profile/edit');
    await expect(
      ownerPage.getByRole('combobox', { name: 'Interested in', exact: true }),
    ).toHaveText('Women');
    await ownerPage.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(ownerPage).toHaveURL(/\/profile$/);
    const saved = await contexts[1].request.get('/api/profile/with-photos');
    expect(saved.status()).toBe(200);
    expect((await saved.json()).profile.genderPreference).toBe('FEMALE');
    const publicResult = await contexts[0].request.get(`/api/profile/${people[1]}`);
    expect(publicResult.status()).toBe(200);
    expect((await publicResult.json()).profile).not.toHaveProperty('genderPreference');
  } finally {
    await owned.close();
  }
});

test('public profile JSON retains an exact private-cache-safe whitelist across location modes and session denial', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 83);
  try {
    const { db, contexts, people, photo, cityId } = owned;
    const path = `/api/profile/${people[1]}`;
    const patch = async (payload: object) => {
      const state = await contexts[1].request.get('/api/profile/location');
      expect(state.status()).toBe(200);
      const response = await contexts[1].request.patch('/api/profile/location', {
        data: {
          ...payload,
          expectedUserId: people[1],
          expectedRevision: (await state.json()).revision,
        },
      });
      expect(response.status()).toBe(200);
    };
    for (const payload of [
      { action: 'CLEAR' },
      { action: 'DEVICE', latitude: 0, longitude: 0 },
      { action: 'VISIBILITY', showDistance: true },
      { action: 'CITY', cityId },
      { action: 'VISIBILITY', showCity: true, showDistance: true },
      { action: 'VISIBILITY', showCity: false, showDistance: false },
    ]) {
      await patch(payload);
      const response = await contexts[0].request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toBe('private, no-store');
      const profile = (await response.json()).profile;
      expect(Object.keys(profile).sort()).toEqual([
        'age',
        'bio',
        'gender',
        'hobbies',
        'interests',
        'lookingFor',
        'name',
        'photos',
        'relationshipType',
        'userId',
      ]);
      expect(profile.userId).toBe(people[1]);
      expect(profile.photos).toHaveLength(1);
      expect(Object.keys(profile.photos[0]).sort()).toEqual([
        'createdAt',
        'id',
        'key',
        'name',
        'url',
      ]);
      expect(profile.photos[0].createdAt).toBe(photo.createdAt.toISOString());
      expect(JSON.stringify(profile)).not.toContain(cityId);
      expect(JSON.stringify(profile)).not.toContain('Synthetic public city');
      const own = await contexts[1].request.get('/api/profile/with-photos');
      expect(own.status()).toBe(200);
      const ownerProfile = (await own.json()).profile;
      expect(ownerProfile.genderPreference).toBe('FEMALE');
      expect(ownerProfile.photos[0].size).toBe(128);
      expect(ownerProfile.photos[0].type).toBe('image/png');
      if ('showCity' in payload && payload.showCity) {
        const ownerPage = await contexts[1].newPage();
        await ownerPage.goto('/profile');
        await expect(
          ownerPage.getByText('Synthetic public city, Synthetic region, Synthetic country', {
            exact: true,
          }),
        ).toBeVisible();
        await ownerPage.close();
      }
    }
    expect((await request.get(path)).status()).toBe(401);
    const missing = await contexts[0].request.get(`/api/profile/${randomUUID()}`);
    expect(missing.status()).toBe(404);
    expect(missing.headers()['cache-control']).toBe('private, no-store');
    await db.session.updateMany({
      where: { userId: people[0] },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await contexts[0].request.get(path);
    expect(expired.status()).toBe(401);
    expect(expired.headers()['cache-control']).toBe('private, no-store');
  } finally {
    await owned.close();
  }
});
