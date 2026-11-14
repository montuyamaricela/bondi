import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const fields = (name: string) => ({
  name,
  age: 28,
  bio: 'Synthetic received-like action verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
});
async function fixture(browser: Browser, baseURL: string, ip: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-received-likes`;
  const contexts: BrowserContext[] = [];
  const people: string[] = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 4; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip + index}` },
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Like owner ${index}`,
          password: 'SyntheticLikes36!',
        },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', { data: fields(`Like owner ${index}`) })
        ).status(),
      ).toBe(201);
    }
    return { db, contexts, people, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('received likes exclude every handled direction before pagination without resetting stored passes', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 244);
  try {
    const { db, contexts, people } = owned;
    await db.like.createMany({
      data: people.slice(1).map((userId, index) => ({
        userId,
        targetUserId: people[0],
        action: 'LIKE',
        createdAt: new Date(Date.UTC(2020, 0, 3 - index)),
      })),
    });
    await db.like.createMany({
      data: [
        { userId: people[0], targetUserId: people[1], action: 'PASS' },
        { userId: people[0], targetUserId: people[2], action: 'LIKE' },
      ],
    });
    const response = await contexts[0].request.get('/api/likes/received?limit=1');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { userId: string }) => item.userId)).toEqual([people[3]]);
    expect(body.nextCursor).toBeNull();
    expect(
      (
        await contexts[0].request.post('/api/discover', {
          data: { targetUserId: people[1], action: 'LIKE' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await contexts[0].request.post('/api/discover', {
          data: { targetUserId: people[1], action: 'PASS' },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await db.like.findUniqueOrThrow({
          where: { userId_targetUserId: { userId: people[0], targetUserId: people[1] } },
        })
      ).action,
    ).toBe('PASS');
    expect(
      await db.like.count({ where: { OR: [{ userId: people[0] }, { targetUserId: people[0] }] } }),
    ).toBe(5);
    const unrelated = await contexts[3].request.get(`/api/likes/received?userId=${people[0]}`);
    expect(unrelated.status()).toBe(200);
    expect((await unrelated.json()).items).toEqual([]);
    expect((await request.get('/api/likes/received')).status()).toBe(401);
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect((await contexts[0].request.get('/api/likes/received')).status()).toBe(401);
  } finally {
    await owned.close();
  }
});

test('a failed pass retains its card and a confirmed pass stays removed through held refetches and reload', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 248);
  const trigger = `bondi_e2e_received_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Like"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  let releaseOld: (() => void) | undefined;
  let releaseFresh: (() => void) | undefined;
  try {
    const { db, contexts, people } = owned;
    await db.like.createMany({
      data: people.slice(1).map((userId) => ({ userId, targetUserId: people[0], action: 'LIKE' })),
    });
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[0]}' THEN RAISE EXCEPTION 'synthetic received-like write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Like" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const page = await contexts[0].newPage();
    await page.goto('/likes');
    const passedHeading = page.getByRole('heading', { name: 'Like owner 1', exact: true });
    await expect(passedHeading).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Like owner 3', exact: true })).toBeVisible();
    const pass = () =>
      passedHeading
        .locator('..')
        .locator('..')
        .getByRole('button', { name: 'Pass', exact: true })
        .click();
    await pass();
    await expect(page.getByText('Failed to pass', { exact: true })).toBeVisible();
    await expect(passedHeading).toBeVisible();
    expect(await db.like.count({ where: { userId: people[0] } })).toBe(0);
    await removeFailure();
    let oldHeld = false;
    let freshHeld = false;
    let gets = 0;
    await page.route('**/api/likes/received**', async (route) => {
      const index = gets++;
      const response = await route.fetch();
      if (index === 0) {
        expect(
          (await response.json()).items.some(
            (item: { userId: string }) => item.userId === people[1],
          ),
        ).toBe(true);
        oldHeld = true;
        await new Promise<void>((resolve) => {
          releaseOld = resolve;
        });
      } else if (index === 1) {
        freshHeld = true;
        await new Promise<void>((resolve) => {
          releaseFresh = resolve;
        });
      }
      try {
        await route.fulfill({ response });
      } catch (error) {
        if (!route.request().failure()) throw error;
      }
    });
    await page
      .getByRole('heading', { name: 'Like owner 2', exact: true })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: 'Pass', exact: true })
      .click();
    await expect.poll(() => oldHeld).toBe(true);
    const saved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/discover' &&
        response.request().method() === 'POST',
    );
    await pass();
    expect((await saved).status()).toBe(200);
    await expect.poll(() => freshHeld).toBe(true);
    // The newer GET is still held: removal must use the confirmed write, not refetch timing.
    await expect(passedHeading).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Like owner 3', exact: true })).toBeVisible();
    releaseOld?.();
    releaseOld = undefined;
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    });
    await expect(passedHeading).toHaveCount(0);
    releaseFresh?.();
    releaseFresh = undefined;
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Like owner 3', exact: true })).toBeVisible();
    await expect(passedHeading).toHaveCount(0);
    const current = await contexts[0].request.get('/api/likes/received');
    expect(current.status()).toBe(200);
    expect((await current.json()).items.map((item: { userId: string }) => item.userId)).toEqual([
      people[3],
    ]);
    expect(
      await db.like.count({
        where: { userId: people[0], targetUserId: people[1], action: 'PASS' },
      }),
    ).toBe(1);
    expect(await db.like.count({ where: { targetUserId: people[0], action: 'LIKE' } })).toBe(3);
  } finally {
    releaseOld?.();
    releaseFresh?.();
    await removeFailure();
    await owned.close();
  }
});
