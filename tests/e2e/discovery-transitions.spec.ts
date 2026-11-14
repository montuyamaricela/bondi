import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { LocationMode, PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type Page } from '@playwright/test';

async function feedFixture(browser: Browser, baseURL: string, ip: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-feed`;
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
      data: { email: `${prefix}@example.test`, name: 'Feed viewer', password: 'SyntheticFeed30!' },
    });
    expect(response.status()).toBe(200);
    const viewer = (await response.json()).user.id;
    const common = {
      age: 97,
      bio: 'Synthetic feed transition fixture.',
      interests: [prefix],
      hobbies: [prefix],
      locationMode: LocationMode.DEVICE,
      showDistance: true,
      latitude: 0,
      longitude: 0,
    };
    await db.profile.create({
      data: {
        ...common,
        userId: viewer,
        name: 'Feed viewer',
        gender: 'MALE',
        genderPreference: 'FEMALE',
      },
    });
    const ids: string[] = [];
    for (const letter of ['A', 'B', 'C', 'D']) {
      const id = `${prefix}-${letter}`;
      ids.push(id);
      await db.user.create({
        data: {
          id,
          email: `${id}@example.test`,
          name: `Candidate ${letter}`,
          emailVerified: false,
        },
      });
      await db.profile.create({
        data: {
          ...common,
          id,
          userId: id,
          name: `Candidate ${letter}`,
          gender: 'FEMALE',
          genderPreference: 'MALE',
        },
      });
    }
    // Permission acquisition is a separate #35 slice.
    await context.addInitScript(() => localStorage.setItem('locationRequested', 'true'));
    return { db, context, viewer, ids, close };
  } catch (error) {
    await close();
    throw error;
  }
}

const heading = (page: Page, letter: string) =>
  page.getByRole('heading', { name: `Candidate ${letter}, 97`, exact: true });
const card = (page: Page) => page.locator('div.cursor-grab');
async function drag(page: Page, direction: 'left' | 'right') {
  const box = await card(page).boundingBox();
  if (!box) throw new Error('Expected a visible discovery card');
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 3, 100);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + (direction === 'right' ? 160 : -160), y, { steps: 8 });
  await page.mouse.up();
}
async function settle(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

test('delayed real discovery refetches do not skip or repeat a candidate after like and pass', async ({
  browser,
  baseURL,
}) => {
  const fixture = await feedFixture(browser, baseURL!, 208);
  let release: (() => void) | undefined;
  try {
    const page = await fixture.context.newPage();
    let hold = false;
    let held = false;
    await page.route('**/api/discover?**', async (route) => {
      const response = await route.fetch();
      if (hold) {
        hold = false;
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.fulfill({ response });
    });
    await page.goto('/discover');
    await expect(heading(page, 'A')).toBeVisible();
    for (const [index, direction] of ['right', 'left', 'right'].entries()) {
      hold = true;
      held = false;
      await drag(page, direction === 'right' ? 'right' : 'left');
      await expect.poll(() => held).toBe(true);
      const next = ['B', 'C', 'D'][index];
      await expect(heading(page, next)).toBeVisible();
      const response = page.waitForResponse(
        (response) => response.url().includes('/api/discover?') && response.status() === 200,
      );
      release?.();
      release = undefined;
      await (await response).finished();
      await settle(page);
      await expect(heading(page, next)).toBeVisible();
      expect(
        await fixture.db.like.findMany({
          where: { userId: fixture.viewer },
          orderBy: { targetUserId: 'asc' },
          select: { targetUserId: true, action: true },
        }),
      ).toEqual(
        fixture.ids.slice(0, index + 1).map((id, actionIndex) => ({
          targetUserId: id,
          action: actionIndex === 1 ? 'PASS' : 'LIKE',
        })),
      );
    }
  } finally {
    release?.();
    await fixture.close();
  }
});

test('a failed swipe returns to the same usable card and an in-flight swipe cannot submit twice', async ({
  browser,
  baseURL,
}) => {
  const fixture = await feedFixture(browser, baseURL!, 209);
  const trigger = `bondi_e2e_feed_${randomUUID().replaceAll('-', '')}`;
  let release: (() => void) | undefined;
  const removeFailure = async () => {
    await fixture.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Like"`);
    await fixture.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, viewer, context, ids } = fixture;
    expect(viewer).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${viewer}' THEN RAISE EXCEPTION 'synthetic feed write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Like" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const page = await context.newPage();
    let posts = 0;
    let hold = false;
    let held = false;
    await page.route('**/api/discover', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      posts++;
      const response = await route.fetch();
      if (hold) {
        hold = false;
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.fulfill({ response });
    });
    await page.goto('/discover');
    await expect(heading(page, 'A')).toBeVisible();
    const original = await card(page).boundingBox();
    if (!original) throw new Error('Expected a visible discovery card');
    await drag(page, 'left');
    await expect(
      page.getByText('Failed to pass profile. Please try again.', { exact: true }),
    ).toBeVisible();
    await expect(heading(page, 'A')).toBeVisible();
    await expect
      .poll(async () => Math.abs((await card(page).boundingBox())!.x - original.x))
      .toBeLessThan(2);
    expect(await db.like.count({ where: { userId: viewer } })).toBe(0);
    await removeFailure();
    hold = true;
    await drag(page, 'left');
    await expect.poll(() => held).toBe(true);
    expect(posts).toBe(2);
    await expect(card(page)).toHaveAttribute('aria-busy', 'true');
    await drag(page, 'right');
    await settle(page);
    expect(posts).toBe(2);
    expect(
      await db.like.findMany({
        where: { userId: viewer },
        select: { targetUserId: true, action: true },
      }),
    ).toEqual([{ targetUserId: ids[0], action: 'PASS' }]);
    release?.();
    release = undefined;
    await expect(heading(page, 'B')).toBeVisible();
    await expect(card(page)).toHaveAttribute('aria-busy', 'false');
  } finally {
    release?.();
    await removeFailure();
    await fixture.close();
  }
});
