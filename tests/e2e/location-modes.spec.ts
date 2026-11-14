import { assertTestDatabase } from '../helpers/test-database';
import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser } from '@playwright/test';

async function fixture(browser: Browser, baseURL: string, offset: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-location-mode`;
  const contexts = await Promise.all(
    [0, 1].map((index) =>
      browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
      }),
    ),
  );
  const people: string[] = [];
  const cityId = String(900_000_000 + randomInt(90_000_000));
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
    for (const [index, context] of contexts.entries()) {
      const signup = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Location owner ${index}`,
          password: 'SyntheticLocation43!',
        },
      });
      expect(signup.status()).toBe(200);
      people.push((await signup.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', {
            data: {
              name: `Location owner ${index}`,
              age: 28,
              bio: 'Synthetic location state verification.',
              gender: 'OTHER',
              interests: ['Synthetic music'],
              hobbies: ['Synthetic reading'],
              relationshipType: 'FRIENDSHIP',
              genderPreference: 'EVERYONE',
            },
          })
        ).status(),
      ).toBe(201);
    }
    await db.locationCity.create({
      data: {
        id: cityId,
        name: 'Synthetic city',
        region: 'Synthetic region',
        country: 'Synthetic country',
        countryCode: 'PH',
        latitude: 0,
        longitude: 0,
        sourceVersion: prefix,
      },
    });
    return { db, people, contexts, cityId, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('location mode operations clear private origins, preserve failed state and enforce owner/revision rules', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 214);
  const path = '/api/profile/location';
  try {
    const { db, people, contexts, cityId } = owned;
    const request = contexts[0].request;
    const patch = (data: object) =>
      request.patch(path, { data: { expectedUserId: people[0], ...data } });
    const read = async () => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toContain('no-store');
      return response.json();
    };
    expect(await read()).toMatchObject({
      userId: people[0],
      mode: 'OFF',
      revision: 0,
      city: null,
      deviceUpdatedAt: null,
      cityUpdatedAt: null,
      showCity: false,
      showDistance: false,
    });
    expect((await request.get(`${path}?userId=${people[1]}`)).status()).toBe(400);
    await db.profile.update({
      where: { userId: people[0] },
      data: { location: 'Synthetic legacy label' },
    });
    const enabled = await patch({
      action: 'DEVICE',
      expectedRevision: 0,
      latitude: 0,
      longitude: 0,
    });
    expect(enabled.status()).toBe(200);
    const device = await enabled.json();
    expect(device).toMatchObject({ mode: 'DEVICE', revision: 1, city: null, legacyLabel: null });
    expect(device.deviceUpdatedAt).toMatch(/Z$/);
    for (const field of ['latitude', 'longitude', 'locationCityId', 'lastLocationUpdate'])
      expect(Object.hasOwn(device, field)).toBe(false);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      latitude: 0,
      longitude: 0,
      locationMode: 'DEVICE',
      location: null,
    });
    expect(
      (await patch({ action: 'VISIBILITY', expectedRevision: 1, showDistance: true })).status(),
    ).toBe(200);
    expect((await patch({ action: 'CITY', expectedRevision: 2, cityId })).status()).toBe(200);
    const savedCity = await read();
    expect(savedCity).toMatchObject({
      mode: 'CITY',
      revision: 3,
      deviceUpdatedAt: null,
      showCity: false,
      showDistance: true,
    });
    expect(savedCity.cityUpdatedAt).toMatch(/Z$/);
    expect(savedCity.preview.distanceMessage).toMatch(/selected city center/);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
      locationCityId: cityId,
      location: null,
    });
    expect(
      (
        await request.patch('/api/profile/privacy', {
          data: {
            expectedUserId: people[0],
            expectedRevision: 3,
            showCity: true,
            showDistance: false,
            showOnlineStatus: false,
          },
        })
      ).status(),
    ).toBe(200);
    expect(await read()).toMatchObject({
      revision: 4,
      showCity: true,
      showDistance: false,
      preview: {
        cityLabel: 'Synthetic city, Synthetic region, Synthetic country',
        distanceMessage: 'Distance hidden',
      },
    });
    const beforeInvalid = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    for (const data of [
      { action: 'DEVICE', expectedRevision: 2, latitude: 0, longitude: 0 },
      { action: 'CLEAR', expectedRevision: 2 },
    ]) {
      const response = await patch(data);
      expect(response.status()).toBe(409);
      expect(await response.json()).toMatchObject({ code: 'LOCATION_CONFLICT' });
    }
    for (const data of [
      { action: 'DEVICE', expectedRevision: 4, latitude: 91, longitude: 0 },
      { action: 'DEVICE', expectedRevision: 4, latitude: 0 },
      { action: 'CITY', expectedRevision: 4, cityId, latitude: 0, longitude: 0 },
      { action: 'CITY', expectedRevision: 4, cityId: 'missing' },
      { action: 'CITY', expectedRevision: 4, cityId: '9999999999' },
      { action: 'CLEAR' },
      { expectedRevision: 4, latitude: 0, longitude: 0 },
      { action: 'VISIBILITY', expectedRevision: 4 },
    ])
      expect((await patch(data)).status()).toBe(400);
    expect(
      (await request.patch('/api/profile/privacy', { data: { showDistance: true } })).status(),
    ).toBe(400);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toEqual(
      beforeInvalid,
    );
    const foreign = await contexts[1].request.patch(path, {
      data: { action: 'CLEAR', expectedUserId: people[0], expectedRevision: 0 },
    });
    expect(foreign.status()).toBe(409);
    expect(await foreign.json()).toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect((await contexts[1].request.get(path)).status()).toBe(200);
    expect((await (await contexts[1].request.get(path)).json()).userId).toBe(people[1]);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 0,
      latitude: null,
      longitude: null,
    });
    expect(
      (
        await request.patch('/api/profile/privacy', {
          data: {
            expectedUserId: people[0],
            expectedRevision: 2,
            showDistance: true,
            showOnlineStatus: true,
          },
        })
      ).status(),
    ).toBe(409);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).showOnlineStatus,
    ).toBe(false);

    await db.$transaction([
      db.locationCity.update({ where: { id: cityId }, data: { available: false } }),
      db.profile.updateMany({
        where: { locationCityId: cityId },
        data: { locationRevision: { increment: 1 } },
      }),
    ]);
    expect(await read()).toMatchObject({
      revision: 5,
      city: { available: false },
      preview: { distanceMessage: 'Distance unavailable' },
    });
    expect(Object.hasOwn((await read()).preview, 'cityLabel')).toBe(false);
    const unavailable = await patch({ action: 'CITY', expectedRevision: 5, cityId });
    expect(unavailable.status()).toBe(400);
    expect(await unavailable.json()).toMatchObject({ code: 'CITY_UNAVAILABLE' });
    expect((await patch({ action: 'CLEAR', expectedRevision: 5 })).status()).toBe(200);
    expect(await read()).toMatchObject({
      mode: 'OFF',
      revision: 6,
      city: null,
      legacyLabel: null,
      deviceUpdatedAt: null,
      cityUpdatedAt: null,
      showCity: false,
      showDistance: false,
    });
    expect((await patch({ action: 'CLEAR', expectedRevision: 6 })).status()).toBe(200);
    const generalFields = {
      name: 'Synthetic general profile',
      age: 28,
      bio: 'Synthetic location bypass verification.',
      gender: 'OTHER',
      interests: ['Synthetic music'],
      hobbies: ['Synthetic reading'],
      relationshipType: 'FRIENDSHIP',
      genderPreference: 'EVERYONE',
    };
    for (const method of ['post', 'patch'] as const) {
      const rejected = await request[method]('/api/profile', {
        data: { ...generalFields, location: 'Synthetic old label' },
      });
      expect(rejected.status()).toBe(400);
      expect((await rejected.json()).details).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'location' })]),
      );
    }
    const edited = await request.patch('/api/profile', {
      data: {
        ...generalFields,
        userId: people[1],
        latitude: 0,
        longitude: 0,
        locationMode: 'DEVICE',
        locationCityId: cityId,
        showCity: true,
        showDistance: true,
        locationRevision: 999,
      },
    });
    expect(edited.status()).toBe(200);
    const editedProfile = (await edited.json()).profile;
    expect(editedProfile).toMatchObject({ userId: people[0], name: generalFields.name });
    for (const field of [
      'latitude',
      'longitude',
      'locationMode',
      'locationCityId',
      'locationRevision',
      'location',
    ])
      expect(Object.hasOwn(editedProfile, field)).toBe(false);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      name: generalFields.name,
      locationMode: 'OFF',
      locationRevision: 7,
      latitude: null,
      longitude: null,
      locationCityId: null,
      cityLocationUpdate: null,
      lastLocationUpdate: null,
      location: null,
      showCity: false,
      showDistance: false,
    });
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).name).toBe(
      'Location owner 1',
    );
    expect(
      (await patch({ action: 'VISIBILITY', expectedRevision: 7, showDistance: true })).status(),
    ).toBe(400);
    await db.locationCity.update({ where: { id: cityId }, data: { available: true } });
    expect((await patch({ action: 'CITY', expectedRevision: 7, cityId })).status()).toBe(200);
    expect(await read()).toMatchObject({
      mode: 'CITY',
      revision: 8,
      showCity: false,
      showDistance: false,
    });
    const beforeExpiry = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    await db.session.updateMany({
      where: { userId: people[0] },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await request.get(path)).status()).toBe(401);
    expect((await patch({ action: 'CLEAR', expectedRevision: 8 })).status()).toBe(401);
    const anonymous = await browser.newContext();
    try {
      expect((await anonymous.request.get(path)).status()).toBe(401);
      expect((await anonymous.request.patch(path, { data: { action: 'CLEAR' } })).status()).toBe(
        401,
      );
    } finally {
      await anonymous.close();
    }
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toEqual(
      beforeExpiry,
    );
  } finally {
    await owned.close();
  }
});

test('real database interleavings reject late device writes after city, clear and visibility changes', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 216);
  try {
    const { db, people, contexts, cityId } = owned;
    const request = contexts[0].request;
    const patch = (data: object) =>
      request.patch('/api/profile/location', { data: { expectedUserId: people[0], ...data } });
    const race = async (firstPayload: object, secondPayload: object) => {
      let unlock!: () => void;
      let acquired!: () => void;
      const locked = new Promise<void>((resolve) => {
        acquired = resolve;
      });
      const release = new Promise<void>((resolve) => {
        unlock = resolve;
      });
      const hold = db.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`SELECT "id" FROM "Profile" WHERE "userId" = ${people[0]} FOR UPDATE`;
          acquired();
          await release;
        },
        { timeout: 30_000 },
      );
      const pending: ReturnType<typeof patch>[] = [];
      const waiterCount = async () =>
        (
          await db.$queryRaw<Array<{ count: number }>>`
        SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database()
          AND wait_event_type = 'Lock' AND query ILIKE 'UPDATE%Profile%'`
        )[0].count;
      try {
        await Promise.race([
          locked,
          hold.then(() => {
            throw new Error('Expected a held row lock');
          }),
        ]);
        pending.push(patch(firstPayload));
        await expect.poll(waiterCount).toBe(1);
        pending.push(patch(secondPayload));
        await expect.poll(waiterCount).toBe(2);
        unlock();
        await hold;
        const [first, second] = await Promise.all(pending);
        expect(first.status()).toBe(200);
        expect(second.status()).toBe(409);
        expect(await second.json()).toMatchObject({ code: 'LOCATION_CONFLICT' });
      } finally {
        unlock();
        await Promise.allSettled([hold, ...pending]);
      }
    };
    await race(
      { action: 'CITY', expectedRevision: 0, cityId },
      { action: 'DEVICE', expectedRevision: 0, latitude: 0, longitude: 0 },
    );
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 1,
      latitude: null,
      longitude: null,
    });
    await race(
      { action: 'CLEAR', expectedRevision: 1 },
      { action: 'DEVICE', expectedRevision: 1, latitude: 0, longitude: 0 },
    );
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 2,
      latitude: null,
      longitude: null,
      locationCityId: null,
    });
    expect((await patch({ action: 'CITY', expectedRevision: 2, cityId })).status()).toBe(200);
    await race(
      { action: 'VISIBILITY', expectedRevision: 3, showCity: true },
      { action: 'DEVICE', expectedRevision: 3, latitude: 0, longitude: 0 },
    );
    expect((await patch({ action: 'CLEAR', expectedRevision: 3 })).status()).toBe(409);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 4,
      latitude: null,
      longitude: null,
      locationCityId: cityId,
      showCity: true,
    });
  } finally {
    await owned.close();
  }
});

test('a failed clear rolls back its origin, visibility and revision and remains explicitly retryable', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 218);
  const trigger = `bondi_e2e_location_${randomUUID().replaceAll('-', '')}`;
  const remove = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, people, contexts } = owned;
    const patch = (data: object) =>
      contexts[0].request.patch('/api/profile/location', {
        data: { expectedUserId: people[0], ...data },
      });
    expect(
      (await patch({ action: 'DEVICE', expectedRevision: 0, latitude: 0, longitude: 0 })).status(),
    ).toBe(200);
    expect(
      (await patch({ action: 'VISIBILITY', expectedRevision: 1, showDistance: true })).status(),
    ).toBe(200);
    const before = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."userId" = '${people[0]}' THEN RAISE EXCEPTION 'synthetic location persistence failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const failed = await patch({ action: 'CLEAR', expectedRevision: 2 });
    expect(failed.status()).toBe(500);
    expect(await failed.json()).toMatchObject({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toEqual(before);
    await remove();
    expect((await patch({ action: 'CLEAR', expectedRevision: 2 })).status()).toBe(200);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 3,
      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
      locationCityId: null,
      cityLocationUpdate: null,
      location: null,
      showCity: false,
      showDistance: false,
    });
  } finally {
    await remove();
    await owned.close();
  }
});
