import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { NextRequest } from 'next/server';
import { createRouteHandler } from 'uploadthing/next';
import { uploadRouter } from '../../lib/server/uploadthing';
import { UPLOAD_USER_HEADER, UPLOAD_SESSION_HEADER } from '../../lib/upload-owner';

const fields = (name: string) => ({
  name,
  age: 28,
  bio: 'Synthetic photo ordering verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
});
const uploaded = () => {
  const key = `synthetic-photo-${randomUUID()}`;
  const url = `https://utfs.io/f/${key}.png`;
  return {
    key,
    url,
    ufsUrl: url,
    appUrl: url,
    name: 'synthetic.png',
    size: 128,
    type: 'image/png',
    customId: null,
    fileHash: 'synthetic',
  };
};
const stored = (userId: string, order: number) => {
  const file = uploaded();
  return {
    userId,
    order,
    key: file.key,
    url: file.url,
    name: file.name,
    size: file.size,
    type: file.type,
  };
};

function uploadHandler(metadata: unknown[]) {
  const token = Buffer.from(
    JSON.stringify({ apiKey: 'sk_synthetic_test_key', appId: 'synthetic', regions: ['sea1'] }),
  ).toString('base64');
  return createRouteHandler({
    router: uploadRouter,
    config: {
      token,
      isDev: false,
      logLevel: 'None',
      handleDaemonPromise: 'await',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        expect(new URL(request.url).pathname).toBe('/route-metadata');
        metadata.push((await request.json()).metadata);
        return Response.json({ ok: true });
      },
    },
  });
}

async function capturedUploadOwner(context: BrowserContext) {
  const response = await context.request.get('/api/auth/get-session');
  expect(response.status()).toBe(200);
  const current = await response.json();
  return {
    [UPLOAD_USER_HEADER]: current.user.id as string,
    [UPLOAD_SESSION_HEADER]: current.session.id as string,
  };
}

async function cookieHeader(context: BrowserContext) {
  return (await context.cookies()).map(({ name, value }) => `${name}=${value}`).join('; ');
}

async function fixture(browser: Browser, baseURL: string, ip: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-photos`;
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
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip + index}` },
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Photo owner ${index}`,
          password: 'SyntheticPhotos34!',
        },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', { data: fields(`Photo owner ${index}`) })
        ).status(),
      ).toBe(201);
    }
    return { db, contexts, people, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('both profile completion handlers share a concurrent six-photo cap, unique append order and idempotent replay', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 228);
  try {
    const { db, people } = owned;
    const files = Array.from({ length: 12 }, uploaded);
    const complete = (index: number) =>
      (index % 2 ? uploadRouter.profileImage : uploadRouter.profilePhotos).onUploadComplete({
        metadata: { userId: people[0] },
        file: files[index],
      });
    const results = await Promise.allSettled(files.map((_, index) => complete(index)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(6);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(6);
    const saved = await db.file.findMany({
      where: { userId: people[0] },
      orderBy: [{ order: 'asc' }, { id: 'asc' }],
    });
    expect(saved).toHaveLength(6);
    expect(saved.map((file) => file.order)).toEqual([0, 1, 2, 3, 4, 5]);
    const accepted = results.findIndex((result) => result.status === 'fulfilled');
    const first = results[accepted];
    expect(first.status).toBe('fulfilled');
    const replay = await complete(accepted);
    if (first.status === 'fulfilled') expect(replay).toEqual(first.value);
    expect(await db.file.count({ where: { userId: people[0] } })).toBe(6);
    await expect(
      uploadRouter.profilePhotos.onUploadComplete({
        metadata: { userId: people[1] },
        file: files[accepted],
      }),
    ).rejects.toThrow();
    expect(await db.file.count({ where: { userId: people[1] } })).toBe(0);
    // A different account still has its own six slots; repeated single-image uploads count too.
    for (let index = 0; index < 6; index++)
      await uploadRouter.profileImage.onUploadComplete({
        metadata: { userId: people[1] },
        file: uploaded(),
      });
    await expect(
      uploadRouter.profileImage.onUploadComplete({
        metadata: { userId: people[1] },
        file: uploaded(),
      }),
    ).rejects.toThrow(/6/);
    expect(await db.file.count({ where: { userId: people[1] } })).toBe(6);
    await db.file.delete({ where: { id: saved[1].id } });
    await uploadRouter.profilePhotos.onUploadComplete({
      metadata: { userId: people[0] },
      file: uploaded(),
    });
    const orders = (
      await db.file.findMany({ where: { userId: people[0] }, orderBy: { order: 'asc' } })
    ).map((file) => file.order);
    expect(orders).toEqual([0, 2, 3, 4, 5, 6]);
  } finally {
    await owned.close();
  }
});

test('authenticated upload middleware checks total remaining capacity before provider requests', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 230);
  try {
    const { db, contexts, people } = owned;
    await db.file.createMany({ data: [0, 1, 2].map((order) => stored(people[0], order)) });
    const cookie = (await contexts[0].cookies())
      .map(({ name, value }) => `${name}=${value}`)
      .join('; ');
    const metadata: unknown[] = [];
    const handler = uploadHandler(metadata);
    const start = (slug: string, count: number, withCookie = true) =>
      handler.POST(
        new NextRequest(`${baseURL}/api/uploadthing?slug=${slug}&actionType=upload`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(withCookie ? { cookie } : {}) },
          body: JSON.stringify({
            files: Array.from({ length: count }, (_, index) => ({
              name: `synthetic-${index}.png`,
              size: 100,
              type: 'image/png',
            })),
            input: null,
          }),
        }),
      );
    expect((await start('profilePhotos', 3)).status).toBe(200);
    expect(metadata).toEqual([{ userId: people[0] }]);
    expect((await start('profilePhotos', 4)).status).toBe(400);
    expect(metadata).toHaveLength(1);
    await db.file.createMany({ data: [3, 4, 5].map((order) => stored(people[0], order)) });
    for (const slug of ['profileImage', 'profilePhotos']) {
      expect((await start(slug, 1)).status).toBe(400);
      expect((await start(slug, 1, false)).status).toBe(403);
    }
    expect(metadata).toHaveLength(1);
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect((await start('profileImage', 1)).status).toBe(403);
    expect(metadata).toHaveLength(1);
  } finally {
    await owned.close();
  }
});

test('saved primary photo and deterministic legacy ties agree across discovery, profiles, likes, matches and inbox', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 232);
  try {
    const { db, contexts, people } = owned;
    const photos = [];
    for (let index = 0; index < 3; index++)
      photos.push(
        await db.file.create({
          data: { ...stored(people[0], index), createdAt: new Date(Date.UTC(2020, 0, index + 1)) },
        }),
      );
    const order = [photos[2], photos[0], photos[1]];
    const saved = await contexts[0].request.patch('/api/profile', {
      data: { ...fields('Photo owner 0'), photoKeys: order.map((photo) => photo.key) },
    });
    expect(saved.status()).toBe(200);
    const checkProfiles = async (expectedKeys: string[]) => {
      for (const [context, path] of [
        [contexts[0], '/api/profile/with-photos'],
        [contexts[1], `/api/profile/${people[0]}`],
      ] as const) {
        const response = await context.request.get(path);
        expect(response.status()).toBe(200);
        expect(
          (await response.json()).profile.photos.map((photo: { key: string }) => photo.key),
        ).toEqual(expectedKeys);
      }
    };
    await checkProfiles(order.map((photo) => photo.key));
    const discovery = await contexts[1].request.get('/api/discover');
    expect(discovery.status()).toBe(200);
    expect(
      (await discovery.json()).find(
        (candidate: { userId: string }) => candidate.userId === people[0],
      ).photos[0].url,
    ).toBe(order[0].url);
    expect(
      (
        await contexts[0].request.post('/api/discover', {
          data: { targetUserId: people[1], action: 'LIKE' },
        })
      ).status(),
    ).toBe(200);
    const likes = await contexts[1].request.get('/api/likes/received');
    expect(likes.status()).toBe(200);
    expect(
      (await likes.json()).items.find((like: { userId: string }) => like.userId === people[0])
        .photos[0].url,
    ).toBe(order[0].url);
    const matched = await contexts[1].request.post('/api/discover', {
      data: { targetUserId: people[0], action: 'LIKE' },
    });
    expect(matched.status()).toBe(200);
    const match = await matched.json();
    expect(match.matched).toBe(true);
    expect(match.matchedUser.photo).toBe(order[0].url);
    const checkMatches = async (url: string) => {
      const list = await contexts[1].request.get('/api/matches');
      expect(list.status()).toBe(200);
      expect(
        (await list.json()).find((item: { matchId: string }) => item.matchId === match.matchId).user
          .image,
      ).toBe(url);
      const detail = await contexts[1].request.get(`/api/matches/${match.matchId}`);
      expect(detail.status()).toBe(200);
      expect((await detail.json()).otherUser.image).toBe(url);
      const inbox = await contexts[1].request.get('/api/matches/conversations');
      expect(inbox.status()).toBe(200);
      expect(
        (await inbox.json()).items.find(
          (item: { matchId: string }) => item.matchId === match.matchId,
        ).otherUser.image,
      ).toBe(url);
    };
    await checkMatches(order[0].url);
    await contexts[0].route('**/_next/image**', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGz8AAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    );
    const page = await contexts[0].newPage();
    await page.goto('/profile');
    await expect(page.getByRole('img', { name: 'Photo owner 0', exact: true })).toHaveAttribute(
      'src',
      new RegExp(encodeURIComponent(order[0].key)),
    );
    // Stable ID tie-breaks retain deterministic output without rewriting legacy data.
    await db.file.updateMany({ where: { userId: people[0] }, data: { order: 0 } });
    const tied = [...photos].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    await checkProfiles(tied.map((photo) => photo.key));
    await checkMatches(tied[0].url);
  } finally {
    await owned.close();
  }
});

test('native upload initiation rejects stale or malformed owners before provider contact', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 236);
  try {
    const { db, contexts, people } = owned;
    const alice = await capturedUploadOwner(contexts[0]);
    const bob = await capturedUploadOwner(contexts[1]);
    const metadata: unknown[] = [];
    const handler = uploadHandler(metadata);
    const start = async (slug: string, owner: Record<string, string>, context = contexts[0]) =>
      handler.POST(
        new NextRequest(`${baseURL}/api/uploadthing?slug=${slug}&actionType=upload`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: await cookieHeader(context),
            ...owner,
          },
          body: JSON.stringify({
            files: [{ name: 'synthetic.png', size: 100, type: 'image/png' }],
            input: null,
          }),
        }),
      );
    const invalid: Array<{ owner: Record<string, string>; status: number }> = [
      { owner: bob, status: 403 },
      { owner: { ...alice, [UPLOAD_SESSION_HEADER]: bob[UPLOAD_SESSION_HEADER] }, status: 403 },
      { owner: { [UPLOAD_USER_HEADER]: alice[UPLOAD_USER_HEADER] }, status: 400 },
      { owner: { [UPLOAD_SESSION_HEADER]: alice[UPLOAD_SESSION_HEADER] }, status: 400 },
      { owner: { ...alice, [UPLOAD_SESSION_HEADER]: '' }, status: 400 },
      { owner: { ...alice, [UPLOAD_USER_HEADER]: 'x'.repeat(129) }, status: 400 },
    ];
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment']) {
      for (const rejected of invalid)
        expect((await start(slug, rejected.owner)).status).toBe(rejected.status);
      expect(metadata).toHaveLength(0);
    }
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment'])
      expect((await start(slug, alice)).status).toBe(200);
    expect(metadata).toEqual(Array.from({ length: 3 }, () => ({ userId: people[0] })));
    expect((await start('profilePhotos', alice, contexts[1])).status).toBe(403);

    const account = await db.user.findUniqueOrThrow({ where: { id: people[0] } });
    expect(
      (
        await contexts[0].request.post('/api/auth/sign-in/email', {
          headers: { Origin: baseURL! },
          data: { email: account.email, password: 'SyntheticPhotos34!' },
        })
      ).status(),
    ).toBe(200);
    const renewed = await capturedUploadOwner(contexts[0]);
    expect(renewed[UPLOAD_SESSION_HEADER]).not.toBe(alice[UPLOAD_SESSION_HEADER]);
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment'])
      expect((await start(slug, alice)).status).toBe(403);
    expect(metadata).toHaveLength(3);
    expect((await start('profilePhotos', renewed)).status).toBe(200);
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    for (const slug of ['profileImage', 'profilePhotos', 'messageAttachment'])
      expect((await start(slug, renewed)).status).toBe(403);
    expect(metadata).toHaveLength(4);
    expect(await db.file.count({ where: { userId: { in: people } } })).toBe(0);
    expect(await db.messageAttachment.count({ where: { userId: { in: people } } })).toBe(0);
  } finally {
    await owned.close();
  }
});

test('the browser sends its captured uploader owner and a stale cookie cannot obtain upload permission', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 238);
  try {
    const { contexts, people, db } = owned;
    const owner = await capturedUploadOwner(contexts[0]);
    const metadata: unknown[] = [];
    const handler = uploadHandler(metadata);
    const page = await contexts[0].newPage();
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.route('**/api/uploadthing?*', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') return route.continue();
      const response = await handler.POST(
        new NextRequest(request.url(), {
          method: 'POST',
          headers: await request.allHeaders(),
          body: request.postData(),
        }),
      );
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: await response.text(),
      });
    });
    await page.goto('/profile/edit');
    await expect(page.locator('input[type=file]')).toBeAttached();
    await contexts[0].clearCookies();
    await contexts[0].addCookies(await contexts[1].cookies());
    const pending = page.waitForResponse(
      (response) =>
        response.url().includes('/api/uploadthing?') && response.request().method() === 'POST',
    );
    await page.locator('input[type=file]').setInputFiles({
      name: 'synthetic.png',
      mimeType: 'image/png',
      buffer: Buffer.from('synthetic image'),
    });
    const response = await pending;
    expect(await response.request().headerValue(UPLOAD_USER_HEADER)).toBe(
      owner[UPLOAD_USER_HEADER],
    );
    expect(await response.request().headerValue(UPLOAD_SESSION_HEADER)).toBe(
      owner[UPLOAD_SESSION_HEADER],
    );
    expect(response.status()).toBe(403);
    await expect(page.getByText('Upload failed', { exact: true })).toBeVisible();
    expect(metadata).toHaveLength(0);
    expect(await db.file.count({ where: { userId: { in: people } } })).toBe(0);
    await expect(page.getByText('Upload successful!', { exact: true })).toHaveCount(0);
  } finally {
    await owned.close();
  }
});

test('changing uploader ownership cancels pending initiation without old-owner feedback', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 240);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = () => {};
  const initiation = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    const { contexts, db, people } = owned;
    const page = await contexts[0].newPage();
    await page.route(/^https:\/\//, (route) => route.abort());
    let requests = 0;
    await page.route('**/api/uploadthing?*', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      requests++;
      entered();
      await held;
      if (!route.request().failure())
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Synthetic unavailable' }),
        });
    });
    await page.goto('/profile/edit');
    await page.locator('input[type=file]').setInputFiles({
      name: 'synthetic.png',
      mimeType: 'image/png',
      buffer: Buffer.from('synthetic image'),
    });
    await initiation;
    const failed = page.waitForEvent('requestfailed', {
      predicate: (request) =>
        request.url().includes('/api/uploadthing?') && request.method() === 'POST',
    });
    await contexts[0].clearCookies();
    await contexts[0].addCookies(await contexts[1].cookies());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Photo owner 1');
    expect((await failed).failure()?.errorText).toContain('ABORTED');
    release();
    await expect(page.getByText('Uploading...', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Upload failed', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Upload successful!', { exact: true })).toHaveCount(0);
    expect(requests).toBe(1);
    expect(await db.file.count({ where: { userId: { in: people } } })).toBe(0);
  } finally {
    release();
    await owned.close();
  }
});

test('a delayed directory-drop callback cannot start an upload after its uploader closes', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 242);
  try {
    const { contexts } = owned;
    const page = await contexts[0].newPage();
    await page.route(/^https:\/\//, (route) => route.abort());
    let requests = 0;
    await page.route('**/api/uploadthing?*', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      requests++;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic unavailable' }),
      });
    });
    await page.goto('/profile/edit');
    await page.locator('input[type=file]').evaluate((input) => {
      const file = new File(['synthetic image'], 'synthetic.png', { type: 'image/png' });
      const fileEntry = {
        isDirectory: false,
        fullPath: '/synthetic/synthetic.png',
        file: (success: (file: File) => void) => {
          document.documentElement.dataset.dropPending = 'true';
          document.addEventListener(
            'resume-synthetic-drop',
            () => {
              success(file);
              document.documentElement.dataset.dropPending = 'complete';
            },
            { once: true },
          );
        },
      };
      const entry = {
        isDirectory: true,
        createReader: () => {
          let read = false;
          return {
            readEntries: (success: (entries: (typeof fileEntry)[]) => void) => {
              const batch = read ? [] : [fileEntry];
              read = true;
              success(batch);
            },
          };
        },
      };
      const item = {
        kind: 'file',
        type: 'image/png',
        getAsFile: () => file,
        webkitGetAsEntry: () => entry,
      };
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { types: ['Files'], items: [item], files: [file] },
      });
      if (!input.parentElement) throw new Error('Synthetic drop needs an uploader');
      input.parentElement.dispatchEvent(event);
    });
    await expect(page.locator('html')).toHaveAttribute('data-drop-pending', 'true');
    await contexts[0].clearCookies();
    await contexts[0].addCookies(await contexts[1].cookies());
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Photo owner 1');
    await page.evaluate(() => document.dispatchEvent(new Event('resume-synthetic-drop')));
    await expect(page.locator('html')).toHaveAttribute('data-drop-pending', 'complete');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    expect(requests).toBe(0);
    await expect(page.getByText('Upload failed', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Upload successful!', { exact: true })).toHaveCount(0);
  } finally {
    await owned.close();
  }
});
