import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';

const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGz8AAAAASUVORK5CYII=',
  'base64',
);
const fields = (name: string) => ({
  name,
  age: 28,
  bio: 'Synthetic keyboard interaction verification.',
  gender: 'OTHER',
  interests: ['Music', 'Art'],
  hobbies: ['Reading', 'Hiking'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
});
async function tabTo(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  for (let index = 0; index < 60; index++) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('The requested control was not reachable by Tab');
}
async function fixture(
  browser: Browser,
  baseURL: string,
  offset: number,
  photos = false,
  mobile = false,
) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-keyboard`;
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
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
        ...(mobile && index === 0
          ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
          : {}),
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Keyboard owner ${index}`,
          password: 'SyntheticKeyboard39!',
        },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', { data: fields(`Keyboard owner ${index}`) })
        ).status(),
      ).toBe(201);
    }
    if (photos) {
      await db.file.createMany({
        data: Array.from({ length: 3 }, (_, index) => ({
          userId: people[0],
          order: index,
          key: `synthetic-${prefix}-${index}`,
          url: `https://utfs.io/f/synthetic-${prefix}-${index}.png`,
          name: `Keyboard photo ${index + 1}`,
          size: 128,
          type: 'image/png',
        })),
      });
      await contexts[0].route('**/_next/image**', (route) =>
        route.fulfill({ contentType: 'image/png', body: pixel }),
      );
      await contexts[0].route('https://utfs.io/**', (route) => {
        expect(new URL(route.request().url()).pathname).toMatch(/^\/f\/synthetic-/);
        return route.fulfill({ contentType: 'image/png', body: pixel });
      });
    }
    return { db, contexts, people, close };
  } catch (error) {
    await close();
    throw error;
  }
}

async function ownedDiscoveryCandidates(owned: Awaited<ReturnType<typeof fixture>>) {
  const marker = `Keyboard-${randomUUID()}`;
  await owned.db.profile.updateMany({
    where: { userId: { in: owned.people } },
    data: { interests: [marker], hobbies: [marker] },
  });
  const response = await owned.contexts[0].request.get('/api/discover');
  expect(response.status()).toBe(200);
  const candidates = (await response.json()).slice(0, 3);
  expect(candidates.map((candidate: { userId: string }) => candidate.userId).sort()).toEqual(
    owned.people.slice(1).sort(),
  );
  return candidates;
}

test('password visibility is named, keyboard reachable and never submits the login form', async ({
  page,
}) => {
  let signIns = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/auth/sign-in/email') signIns++;
  });
  await page.goto('/login');
  const input = page.getByLabel('Password', { exact: true });
  await input.fill('SyntheticHidden39!');
  await tabTo(page, page.getByRole('button', { name: 'Show password', exact: true }));
  await page.keyboard.press('Enter');
  await expect(input).toHaveAttribute('type', 'text');
  await expect(input).toHaveValue('SyntheticHidden39!');
  await expect(page.getByRole('button', { name: 'Hide password', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await expect(input).toHaveAttribute('type', 'password');
  expect(signIns).toBe(0);
});

test('a keyboard user removes a named selected interest without removing other selections', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 50);
  try {
    const page = await owned.contexts[0].newPage();
    await page.goto('/profile/edit');
    await tabTo(page, page.getByRole('button', { name: 'Remove Music', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Music', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove Art', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Reading', exact: true })).toBeVisible();
    await tabTo(page, page.getByRole('button', { name: 'Save Changes', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/profile$/);
    const profile = await owned.db.profile.findUniqueOrThrow({
      where: { userId: owned.people[0] },
    });
    expect(profile.interests).toEqual(['Art']);
    expect(profile.hobbies).toEqual(['Reading', 'Hiking']);
  } finally {
    await owned.close();
  }
});

test('keyboard discovery actions preserve retry, pending guards and accepted like/pass outcomes', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 54 + test.info().repeatEachIndex * 4);
  const trigger = `bondi_e2e_keyboard_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Like"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  let release: (() => void) | undefined;
  let releaseFailure: (() => void) | undefined;
  try {
    const { db, contexts, people } = owned;
    const candidates = await ownedDiscoveryCandidates(owned);
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[0]}' THEN RAISE EXCEPTION 'synthetic keyboard action failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Like" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const page = await contexts[0].newPage();
    await page.goto('/discover');
    const pass = page.getByRole('button', { name: 'Pass profile', exact: true });
    const like = page.getByRole('button', { name: 'Like profile', exact: true });
    let failureHeld = false;
    let holdFailure = true;
    await page.route('**/api/discover', async (route) => {
      if (route.request().method() !== 'POST' || !holdFailure) return route.continue();
      holdFailure = false;
      const failed = await route.fetch();
      expect(failed.status()).toBe(500);
      failureHeld = true;
      await new Promise<void>((resolve) => {
        releaseFailure = resolve;
      });
      await route.fulfill({ response: failed });
    });
    await tabTo(page, pass);
    await page.keyboard.press('Enter');
    await expect.poll(() => failureHeld).toBe(true);
    await expect(pass).toBeDisabled();
    releaseFailure?.();
    releaseFailure = undefined;
    await expect(
      page.getByText('Failed to pass profile. Please try again.', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: `${candidates[0].name}, 28`, exact: true }),
    ).toBeVisible();
    await expect(pass).toBeEnabled();
    await expect(pass).toBeFocused();
    expect(await db.like.count({ where: { userId: people[0] } })).toBe(0);
    await removeFailure();
    let held = false;
    let hold = true;
    await page.route('**/api/discover', async (route) => {
      if (route.request().method() !== 'POST' || !hold) return route.continue();
      hold = false;
      const saved = await route.fetch();
      expect(saved.status()).toBe(200);
      held = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ response: saved });
    });
    await tabTo(page, pass);
    await page.keyboard.press('Enter');
    await expect.poll(() => held).toBe(true);
    await expect(pass).toBeDisabled();
    await expect(like).toBeDisabled();
    expect(await db.like.count({ where: { userId: people[0] } })).toBe(1);
    release?.();
    release = undefined;
    await expect(
      page.getByRole('heading', { name: `${candidates[1].name}, 28`, exact: true }),
    ).toBeVisible();
    await tabTo(page, like);
    await page.keyboard.press('Space');
    await expect(
      page.getByRole('heading', { name: `${candidates[2].name}, 28`, exact: true }),
    ).toBeVisible();
    expect(
      (
        await db.like.findUniqueOrThrow({
          where: { userId_targetUserId: { userId: people[0], targetUserId: candidates[0].userId } },
        })
      ).action,
    ).toBe('PASS');
    expect(
      (
        await db.like.findUniqueOrThrow({
          where: { userId_targetUserId: { userId: people[0], targetUserId: candidates[1].userId } },
        })
      ).action,
    ).toBe('LIKE');
  } finally {
    release?.();
    releaseFailure?.();
    await removeFailure();
    await owned.close();
  }
});

test('photo viewer traps keyboard focus, navigates images and restores its opener on repeated close', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 58, true);
  try {
    const page = await owned.contexts[0].newPage();
    await page.goto('/profile');
    const opener = page.getByRole('button', { name: 'View photo 1', exact: true });
    const overflow = await page.evaluate(() => getComputedStyle(document.body).overflow);
    await tabTo(page, opener);
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Photo viewer', exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole('button', { name: 'Close photo viewer', exact: true });
    await expect(close).toBeFocused();
    for (const key of ['Tab', 'Shift+Tab'])
      for (let index = 0; index < 8; index++) {
        await page.keyboard.press(key);
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
          true,
        );
      }
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 2', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 1', exact: true })).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 3', exact: true })).toBeVisible();
    await tabTo(page, dialog.getByRole('button', { name: 'Next image', exact: true }));
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 1', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe(overflow);
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    await expect(close).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  } finally {
    await owned.close();
  }
});

test('emulated mobile touch reaches discovery actions and photo navigation without gestures', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 62, true, true);
  try {
    const page = await owned.contexts[0].newPage();
    const candidates = await ownedDiscoveryCandidates(owned);
    await page.goto('/discover');
    for (const [index, name] of ['Pass profile', 'Like profile'].entries()) {
      await expect(
        page.getByRole('heading', { name: `${candidates[index].name}, 28`, exact: true }),
      ).toBeVisible();
      const action = page.getByRole('button', { name, exact: true });
      await action.scrollIntoViewIfNeeded();
      const box = await action.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
      await action.tap();
    }
    await expect(
      page.getByRole('heading', { name: `${candidates[2].name}, 28`, exact: true }),
    ).toBeVisible();
    expect(await owned.db.like.count({ where: { userId: owned.people[0] } })).toBe(2);
    await page.goto('/profile');
    await page.getByRole('button', { name: 'View photo 2', exact: true }).tap();
    const dialog = page.getByRole('dialog', { name: 'Photo viewer', exact: true });
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 2', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Next image', exact: true }).tap();
    await expect(dialog.getByRole('img', { name: 'Keyboard photo 3', exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Close photo viewer', exact: true }).tap();
    await expect(dialog).toHaveCount(0);
  } finally {
    await owned.close();
  }
});
