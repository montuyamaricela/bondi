import { randomUUID } from 'node:crypto';
import { PrismaClient, type File } from '@prisma/client';
import { expect, test, type Browser, type Locator, type Page, type Route } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';
import { deleteProfilePhoto } from '../../lib/server/profile-photo-delete';

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let index = 0; index < 60; index++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Photo control was not reachable by Tab');
}

async function fixture(browser: Browser, baseURL: string, ip: number) {
  assertTestDatabase();
  expect(process.env.UPLOADTHING_TOKEN || '').toBe('');
  const db = new PrismaClient();
  const email = `bondi-e2e-${randomUUID()}-photo-keyboard@example.test`;
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `203.0.113.${ip}` },
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
      data: { email, name: 'Gallery owner', password: 'SyntheticGallery43!' },
    });
    expect(signup.status()).toBe(200);
    const userId: string = (await signup.json()).user.id;
    expect(
      (
        await context.request.post('/api/profile', {
          data: {
            name: 'Gallery owner',
            age: 28,
            bio: 'Synthetic photo keyboard fixture.',
            gender: 'OTHER',
            interests: ['Music'],
            hobbies: ['Reading'],
            relationshipType: 'FRIENDSHIP',
            genderPreference: 'EVERYONE',
          },
        })
      ).status(),
    ).toBe(201);
    const photos: File[] = [];
    for (let index = 0; index < 3; index++) {
      const key = `synthetic-${randomUUID()}`;
      photos.push(
        await db.file.create({
          data: {
            userId,
            key,
            url: `https://utfs.io/f/${key}.png`,
            name: `Gallery photo ${index + 1}`,
            order: index,
            size: 128,
            type: 'image/png',
          },
        }),
      );
    }
    await context.route('**/_next/image**', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGz8AAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    const completeDelete = async (route: Route) => {
      const key = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-1)!);
      expect(photos.some((photo) => photo.key === key)).toBe(true);
      // Real ownership/DB operation with controlled provider success; no external object exists.
      await deleteProfilePhoto(userId, key, async () => ({ success: true, deletedCount: 1 }));
      await route.fulfill({
        status: 200,
        json: { success: true, message: 'Photo deleted successfully' },
      });
    };
    return { context, db, userId, photos, completeDelete, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('keyboard photo ordering retains focus, retries save and reloads the main photo', async ({
  browser,
  baseURL,
}, testInfo) => {
  const owned = await fixture(browser, baseURL!, 71);
  try {
    const { context, db, userId, photos } = owned;
    const page = await context.newPage();
    await page.goto('/profile/edit');
    await expect(page.getByRole('button', { name: 'Delete photo 1', exact: true })).toBeVisible();
    const gallery = page.getByRole('list', { name: 'Profile photos' });
    const images = gallery.getByRole('img');
    const order = async () =>
      images.evaluateAll((items) => items.map((item) => item.getAttribute('alt')));
    await expect(
      page.getByRole('button', { name: 'Move photo 1 earlier', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Move photo 3 later', exact: true }),
    ).toBeDisabled();
    for (const label of ['Delete photo 1', 'Move photo 2 earlier', 'Move photo 2 later']) {
      const bounds = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await tabTo(page, page.getByRole('button', { name: 'Move photo 2 earlier', exact: true }));
    await page.keyboard.press('Space');
    await expect.poll(order).toEqual([photos[1].name, photos[0].name, photos[2].name]);
    await expect(
      page.getByRole('button', { name: 'Move photo 1 later', exact: true }),
    ).toBeFocused();
    await expect(page.getByRole('status', { name: 'Photo updates' })).toContainText(
      'Photo 2 moved to position 1 of 3',
    );
    await page.keyboard.press('Enter');
    await expect.poll(order).toEqual(photos.map((photo) => photo.name));
    await expect(
      page.getByRole('button', { name: 'Move photo 2 later', exact: true }),
    ).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: 'Move photo 3 earlier', exact: true }));
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Move photo 2 earlier', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Space');
    const expected = [photos[2], photos[0], photos[1]];
    await expect.poll(order).toEqual(expected.map((photo) => photo.name));
    await expect(
      page.getByRole('button', { name: 'Move photo 1 later', exact: true }),
    ).toBeFocused();
    await expect(
      gallery.getByRole('listitem').first().getByText('Main', { exact: true }),
    ).toBeVisible();
    const screenshot = testInfo.outputPath('photo-keyboard-order.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach('Keyboard photo order', { path: screenshot, contentType: 'image/png' });
    expect(
      (await db.file.findMany({ where: { userId }, orderBy: { order: 'asc' } })).map(
        (photo) => photo.key,
      ),
    ).toEqual(photos.map((photo) => photo.key));
    let rejectSave = true;
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() === 'PATCH' && rejectSave) {
        rejectSave = false;
        await route.fulfill({ status: 503, json: { error: 'Synthetic save failure' } });
      } else await route.continue();
    });
    await tabTo(page, page.getByRole('button', { name: 'Save Changes', exact: true }));
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Failed to update profile. Please try again.', { exact: true }),
    ).toBeVisible();
    await expect.poll(order).toEqual(expected.map((photo) => photo.name));
    await tabTo(page, page.getByRole('button', { name: 'Save Changes', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/profile$/);
    const saved = await context.request.get('/api/profile/with-photos');
    expect(saved.status()).toBe(200);
    expect((await saved.json()).profile.photos.map((photo: { key: string }) => photo.key)).toEqual(
      expected.map((photo) => photo.key),
    );
    await expect(page.getByRole('img', { name: 'Gallery owner', exact: true })).toHaveAttribute(
      'src',
      new RegExp(encodeURIComponent(expected[0].key)),
    );
    await page.goto('/profile/edit');
    await expect.poll(order).toEqual(expected.map((photo) => photo.name));
    await expect(
      page.getByRole('button', { name: 'Move photo 1 earlier', exact: true }),
    ).toBeDisabled();
    await gallery.getByRole('listitem').last().dragTo(gallery.getByRole('listitem').first());
    await expect.poll(order).toEqual([expected[2].name, expected[0].name, expected[1].name]);
  } finally {
    await owned.close();
  }
});

test('photo deletion preserves pending state, failure focus and a usable empty-gallery destination', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 72);
  const ready = Promise.withResolvers<void>();
  try {
    const { context, db, userId, completeDelete } = owned;
    const page = await context.newPage();
    let requests = 0;
    await page.route('**/api/profile/photos/*', async (route) => {
      requests++;
      const response = await route.fetch();
      expect(response.status()).toBe(503); // Genuine authorized handler, missing external configuration.
      if (requests === 1) await route.fulfill({ response });
      else {
        await ready.promise;
        await completeDelete(route);
      }
    });
    await page.goto('/profile/edit');
    const gallery = page.getByRole('list', { name: 'Profile photos' });
    const remove = page.getByRole('button', { name: 'Delete photo 2', exact: true });
    await tabTo(page, remove);
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Photo deletion could not be completed. Please try again.', { exact: true }),
    ).toBeVisible();
    await expect(remove).toBeFocused();
    await expect(gallery.getByRole('listitem')).toHaveCount(3);
    await page.keyboard.press('Space');
    await expect.poll(() => requests).toBe(2);
    await expect(remove).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Move photo 2 earlier', exact: true }),
    ).toBeDisabled();
    await expect(gallery.getByRole('listitem').first()).toHaveAttribute('draggable', 'false');
    await page.keyboard.press('Space');
    expect(requests).toBe(2);
    expect(await db.file.count({ where: { userId } })).toBe(3);
    ready.resolve();
    await expect(gallery.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Delete photo 2', exact: true })).toBeFocused();
    await expect(page.getByRole('status', { name: 'Photo updates' })).toContainText(
      'Photo 2 deleted',
    );
    await page.keyboard.press('Enter');
    await expect(gallery.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Delete photo 1', exact: true })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(gallery).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Photos', exact: true })).toBeFocused();
    expect(await db.file.count({ where: { userId } })).toBe(0);
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('button', { name: 'Upload profile photos', exact: true }),
    ).toBeFocused();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    await (await chooser).setFiles([]);
  } finally {
    ready.resolve();
    await owned.close();
  }
});

test('an asynchronous photo deletion does not steal focus from another field', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 73);
  const ready = Promise.withResolvers<void>();
  try {
    const { context, completeDelete } = owned;
    const page = await context.newPage();
    let held = false;
    await page.route('**/api/profile/photos/*', async (route) => {
      expect((await route.fetch()).status()).toBe(503);
      held = true;
      await ready.promise;
      await completeDelete(route);
    });
    await page.goto('/profile/edit');
    await tabTo(page, page.getByRole('button', { name: 'Delete photo 2', exact: true }));
    await page.keyboard.press('Enter');
    await expect.poll(() => held).toBe(true);
    const name = page.getByRole('textbox', { name: 'Name', exact: true });
    await tabTo(page, name);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type(' amended');
    await expect(name).toHaveValue('Gallery owner amended');
    ready.resolve();
    await expect(
      page.getByRole('list', { name: 'Profile photos' }).getByRole('listitem'),
    ).toHaveCount(2);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Gallery owner amended');
  } finally {
    ready.resolve();
    await owned.close();
  }
});
