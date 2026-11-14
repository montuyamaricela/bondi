import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const fields = (name = 'Synthetic profile') => ({
  name,
  age: 28,
  bio: 'A synthetic profile for write verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
  lookingFor: 'Coffee',
});
const invalidFields = [
  { age: 18.5 },
  { age: 17 },
  { age: 101 },
  { interests: [] },
  { hobbies: [] },
  { interests: Array.from({ length: 11 }, (_, index) => `Interest ${index}`) },
  { hobbies: Array.from({ length: 11 }, (_, index) => `Hobby ${index}`) },
  { interests: ['x'.repeat(101)] },
  { hobbies: [' '] },
  { name: 'A' },
  { name: 'x'.repeat(51) },
  { bio: 'short' },
  { bio: 'x'.repeat(501) },
  { gender: 'unsupported' },
  { relationshipType: 'unsupported' },
  { genderPreference: 'unsupported' },
];

async function fixture(browser: Browser, baseURL: string, ip: number) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-profile-writes`;
  const contexts: BrowserContext[] = [];
  const people: Array<{ id: string; name: string }> = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip + index}` },
      });
      contexts.push(context);
      const name = `Profile owner ${index}`;
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email: `${prefix}-${index}@example.test`, name, password: 'SyntheticProfile32!' },
      });
      expect(response.status()).toBe(200);
      people.push({ id: (await response.json()).user.id, name });
    }
    const snapshot = async (userId: string) => ({
      user: await db.user.findUnique({ where: { id: userId }, select: { name: true } }),
      profile: await db.profile.findUnique({ where: { userId } }),
      files: await db.file.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    });
    return { db, contexts, people, snapshot, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('setup rejects invalid profile fields before changing the user and preserves supported custom labels', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 216);
  try {
    const { db, contexts, people } = owned;
    for (const invalid of invalidFields) {
      const response = await contexts[0].request.post('/api/profile', {
        data: { ...fields('Attempted profile rename'), ...invalid },
      });
      expect(response.status(), Object.keys(invalid).join(',')).toBe(400);
      expect(await db.profile.count({ where: { userId: people[0].id } })).toBe(0);
      expect((await db.user.findUniqueOrThrow({ where: { id: people[0].id } })).name).toBe(
        people[0].name,
      );
    }
    expect(
      (
        await contexts[0].request.post('/api/profile', {
          headers: { 'Content-Type': 'application/json' },
          data: '{',
        })
      ).status(),
    ).toBe(400);
    expect((await request.post('/api/profile', { data: fields() })).status()).toBe(401);
    const valid = {
      ...fields('Saved setup profile'),
      age: 18,
      interests: ['A supported custom interest'],
      hobbies: ['A supported custom hobby'],
    };
    expect((await contexts[0].request.post('/api/profile', { data: valid })).status()).toBe(201);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0].id } })).toMatchObject(
      valid,
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: people[0].id } })).name).toBe(
      valid.name,
    );
    expect((await contexts[0].request.post('/api/profile', { data: valid })).status()).toBe(400);
  } finally {
    await owned.close();
  }
});

test('edits enforce the same field rules and reject missing or expired sessions without partial changes', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 218);
  try {
    const { db, contexts, people, snapshot } = owned;
    expect(
      (
        await contexts[0].request.post('/api/profile', { data: fields('Original editor') })
      ).status(),
    ).toBe(201);
    const before = await snapshot(people[0].id);
    for (const invalid of [invalidFields[3], ...invalidFields]) {
      const response = await contexts[0].request.patch('/api/profile', {
        data: { ...fields('Attempted edit rename'), ...invalid },
      });
      expect(response.status(), Object.keys(invalid).join(',')).toBe(400);
      expect(await snapshot(people[0].id)).toEqual(before);
    }
    expect(
      (
        await contexts[0].request.patch('/api/profile', {
          headers: { 'Content-Type': 'application/json' },
          data: '{',
        })
      ).status(),
    ).toBe(400);
    expect((await request.patch('/api/profile', { data: fields() })).status()).toBe(401);
    const valid = {
      ...fields('Saved editor'),
      age: 100,
      interests: ['Custom interest'],
      hobbies: ['Custom hobby'],
      userId: people[1].id,
    };
    expect((await contexts[0].request.patch('/api/profile', { data: valid })).status()).toBe(200);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0].id } })).toMatchObject({
      name: valid.name,
      age: 100,
      interests: valid.interests,
    });
    expect(await db.profile.count({ where: { userId: people[1].id } })).toBe(0);
    const saved = await snapshot(people[0].id);
    await db.session.updateMany({
      where: { userId: people[0].id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect(
      (
        await contexts[0].request.patch('/api/profile', { data: fields('Revoked rename') })
      ).status(),
    ).toBe(401);
    expect(await snapshot(people[0].id)).toEqual(saved);
  } finally {
    await owned.close();
  }
});

test('a failed profile creation rolls back the related account name and can be retried', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 220);
  const trigger = `bondi_e2e_profile_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, contexts, people } = owned;
    expect(people[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[0].id}' THEN RAISE EXCEPTION 'synthetic profile creation failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const payload = fields('Atomic setup rename');
    expect((await contexts[0].request.post('/api/profile', { data: payload })).status()).toBe(500);
    expect((await db.user.findUniqueOrThrow({ where: { id: people[0].id } })).name).toBe(
      people[0].name,
    );
    expect(await db.profile.count({ where: { userId: people[0].id } })).toBe(0);
    await removeFailure();
    expect((await contexts[0].request.post('/api/profile', { data: payload })).status()).toBe(201);
    expect((await db.user.findUniqueOrThrow({ where: { id: people[0].id } })).name).toBe(
      payload.name,
    );
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('photo ordering requires the complete owned unique key set and commits with profile changes', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 222);
  const trigger = `bondi_e2e_reorder_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "File"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, contexts, people, snapshot } = owned;
    expect(
      (
        await contexts[0].request.post('/api/profile', { data: fields('Original gallery owner') })
      ).status(),
    ).toBe(201);
    const keys = [randomUUID(), randomUUID(), randomUUID()];
    for (const [index, key] of keys.entries())
      await db.file.create({
        data: {
          key,
          userId: people[index === 2 ? 1 : 0].id,
          url: `https://files.example.test/${key}.jpg`,
          name: 'synthetic.jpg',
          size: 1024,
          type: 'image/jpeg',
          order: index === 2 ? 0 : index,
        },
      });
    const before = await snapshot(people[0].id);
    const foreignBefore = await snapshot(people[1].id);
    for (const photoKeys of [
      [keys[0], keys[0]],
      [],
      [keys[0]],
      [keys[0], keys[2]],
      [keys[0], 'missing-owned-photo'],
      [''],
    ]) {
      expect(
        (
          await contexts[0].request.patch('/api/profile', {
            data: { ...fields('Rejected gallery rename'), photoKeys },
          })
        ).status(),
      ).toBe(400);
      expect(await snapshot(people[0].id)).toEqual(before);
      expect(await snapshot(people[1].id)).toEqual(foreignBefore);
    }
    expect(people[0].id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[0].id}' THEN RAISE EXCEPTION 'synthetic photo order failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "File" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const payload = { ...fields('Atomic gallery rename'), photoKeys: [keys[1], keys[0]] };
    expect((await contexts[0].request.patch('/api/profile', { data: payload })).status()).toBe(500);
    expect(await snapshot(people[0].id)).toEqual(before);
    await removeFailure();
    const response = await contexts[0].request.patch('/api/profile', { data: payload });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.profile.photos.map((photo: { key: string }) => photo.key)).toEqual(
      payload.photoKeys,
    );
    expect((await db.user.findUniqueOrThrow({ where: { id: people[0].id } })).name).toBe(
      payload.name,
    );
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[0].id } })).name).toBe(
      payload.name,
    );
    expect(
      (await db.file.findMany({ where: { userId: people[0].id }, orderBy: { order: 'asc' } })).map(
        (photo) => ({ key: photo.key, order: photo.order }),
      ),
    ).toEqual(payload.photoKeys.map((key, order) => ({ key, order })));
    expect(await snapshot(people[1].id)).toEqual(foreignBefore);
    const concurrent = [
      { ...fields('Concurrent profile A'), photoKeys: [keys[0], keys[1]] },
      { ...fields('Concurrent profile B'), photoKeys: [keys[1], keys[0]] },
    ];
    const results = await Promise.all(
      concurrent.map((data) => contexts[0].request.patch('/api/profile', { data })),
    );
    for (const [index, result] of results.entries()) {
      expect(result.status()).toBe(200);
      const saved = (await result.json()).profile;
      expect(saved.name).toBe(concurrent[index].name);
      expect(saved.photos.map((photo: { key: string }) => photo.key)).toEqual(
        concurrent[index].photoKeys,
      );
    }
    const final = await snapshot(people[0].id);
    expect(final.user?.name).toBe(final.profile?.name);
    const winner = concurrent.find((data) => data.name === final.profile?.name);
    expect(winner).toBeDefined();
    expect([...final.files].sort((a, b) => a.order - b.order).map((photo) => photo.key)).toEqual(
      winner?.photoKeys,
    );
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('profile age inputs retain fractions and cleared values instead of silently substituting an integer', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 224);
  try {
    const { contexts, db, people } = owned;
    expect(
      (await contexts[0].request.post('/api/profile', { data: fields('Browser editor') })).status(),
    ).toBe(201);
    const page = await contexts[0].newPage();
    await page.goto('/profile/edit');
    const age = page.getByLabel('Age', { exact: true });
    await age.fill('18.5');
    await expect(age).toHaveValue('18.5');
    await age.fill('');
    await expect(age).toHaveValue('');
    await age.fill('28');
    await page.getByLabel('Name', { exact: true }).fill('Saved browser profile');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(
      page.getByRole('heading', { name: 'Saved browser profile, 28', exact: true }),
    ).toBeVisible();
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[0].id } })).name).toBe(
      'Saved browser profile',
    );
    const setup = await contexts[1].newPage();
    await setup.goto('/profile/setup');
    const setupAge = setup.getByLabel('Age', { exact: true });
    await setupAge.fill('18.5');
    await expect(setupAge).toHaveValue('18.5');
    await setupAge.fill('');
    await expect(setupAge).toHaveValue('');
  } finally {
    await owned.close();
  }
});
