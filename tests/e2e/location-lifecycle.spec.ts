import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

declare global {
  interface Window {
    locationProbe: {
      calls: number;
      mode: 'success' | 'error' | 'deferred';
      code: number;
      options?: PositionOptions;
      complete?: () => void;
    };
    locationProbeApi: Geolocation;
  }
}
const fields = (name: string) => ({
  name,
  age: 28,
  bio: 'Synthetic location lifecycle verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
});
async function fixture(browser: Browser, baseURL: string, ip: number) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-location`;
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
          name: `Location owner ${index}`,
          password: 'SyntheticLocation35!',
        },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
      expect(
        (
          await context.request.post('/api/profile', { data: fields(`Location owner ${index}`) })
        ).status(),
      ).toBe(201);
    }
    return { db, contexts, people, close };
  } catch (error) {
    await close();
    throw error;
  }
}
async function installGeolocation(page: Page) {
  await page.addInitScript(() => {
    window.locationProbe = { calls: 0, mode: 'success', code: 1 };
    window.locationProbeApi = {
      getCurrentPosition(success, failure, options) {
        const probe = window.locationProbe;
        probe.calls++;
        probe.options = options;
        const complete = () =>
          success({
            coords: {
              latitude: 0,
              longitude: 0,
              accuracy: 100,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            },
            timestamp: Date.now(),
          } as GeolocationPosition);
        if (probe.mode === 'deferred') probe.complete = complete;
        else if (probe.mode === 'error')
          queueMicrotask(() =>
            failure?.({
              code: probe.code,
              message: 'Synthetic native failure',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            }),
          );
        else queueMicrotask(complete);
      },
      watchPosition() {
        throw new Error('Background location tracking is outside this feature');
      },
      clearWatch() {},
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: window.locationProbeApi,
    });
  });
}
const lastKnown = (page: Page) => page.getByText(/saved last-known location/i);

test('discovery never requests location automatically and an explicit save refreshes its cached feed without reload', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 234);
  try {
    const { db, contexts, people } = owned;
    await db.profile.update({
      where: { userId: people[1] },
      data: { latitude: 0, longitude: 0, lastLocationUpdate: new Date() },
    });
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    let feedReads = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/discover' && request.method() === 'GET')
        feedReads++;
    });
    await page.goto('/discover');
    await expect(page.getByRole('heading', { name: 'Location owner 1, 28' })).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
    const before = feedReads;
    await page.getByRole('button', { name: /Location owner 0$/ }).click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    const saved = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    expect(saved.latitude).toBe(0);
    expect(saved.longitude).toBe(0);
    expect(saved.lastLocationUpdate).not.toBeNull();
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      saved.lastLocationUpdate!.toISOString(),
    );
    await expect(page.getByRole('button', { name: 'Refresh Location', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.locationProbe.options)).toMatchObject({
      maximumAge: 0,
      enableHighAccuracy: false,
      timeout: 10000,
    });
    await page.getByRole('link', { name: 'Discover', exact: true }).click();
    await expect(page.getByText('Less than 1 km away', { exact: true })).toBeVisible();
    expect(feedReads).toBeGreaterThan(before);
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('locationRequested'))).toBeNull();
  } finally {
    await owned.close();
  }
});

test('native denial, unavailable, timeout, unsupported and insecure-context failures are recoverable', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 236);
  try {
    const page = await owned.contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    for (const [code, message] of [
      [1, /Location permission denied/],
      [2, /Your location is unavailable/],
      [3, /Location request timed out/],
    ] as const) {
      await page.evaluate((value) => {
        window.locationProbe.mode = 'error';
        window.locationProbe.code = value;
      }, code);
      await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Enable Location', exact: true }),
      ).toBeEnabled();
    }
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }),
    );
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /not supported by this browser/ }),
    ).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: window.locationProbeApi,
      });
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    });
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /requires a secure connection/ }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(3);
    await page.evaluate(() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(4);
  } finally {
    await owned.close();
  }
});

test('failed location persistence retains a retryable fix without requesting device location again', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 238);
  const trigger = `bondi_e2e_location_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, people, contexts } = owned;
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[0]}' THEN RAISE EXCEPTION 'synthetic location write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /location could not be saved/ }),
    ).toBeVisible();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).latitude,
    ).toBeNull();
    await removeFailure();
    await page.getByRole('button', { name: 'Retry save', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(1);
    await expect(page.getByRole('button', { name: 'Refresh Location', exact: true })).toBeEnabled();
    // Saved zero coordinates remain last-known on a new mount, without another request.
    await page.reload();
    await expect(lastKnown(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh Location', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('delayed device results cannot cross accounts or save after leaving settings', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 240);
  try {
    const { db, contexts, people } = owned;
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    await page.evaluate(() => {
      window.locationProbe.mode = 'deferred';
    });
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.locationProbe.calls)).toBe(1);
    await contexts[0].clearCookies();
    await contexts[0].addCookies(await contexts[1].cookies());
    const rejected = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/profile/location' &&
        response.request().method() === 'PATCH',
    );
    await page.evaluate(() => window.locationProbe.complete?.());
    expect((await rejected).status()).toBe(409);
    for (const userId of people)
      expect((await db.profile.findUniqueOrThrow({ where: { userId } })).latitude).toBeNull();
    const session = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/get-session' && response.status() === 200,
    );
    await page.clock.setFixedTime(await page.evaluate(() => Date.now() + 6000));
    await page.bringToFront();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await session;
    await expect(page.getByRole('button', { name: /Location owner 1$/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable Location', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert').filter({ hasText: /account changed/ })).toHaveCount(0);
    await page.evaluate(() => {
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('button', { name: 'Enable Location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).latitude).toBe(0);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).latitude,
    ).toBeNull();
    await page.evaluate(() => {
      window.locationProbe.mode = 'deferred';
    });
    await page.getByRole('button', { name: 'Refresh Location', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.locationProbe.calls)).toBe(3);
    let patches = 0;
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/api/profile/location' &&
        request.method() === 'PATCH'
      )
        patches++;
    });
    await page.getByRole('link', { name: 'Discover', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Location owner 0, 28' })).toBeVisible();
    await page.evaluate(async () => {
      window.locationProbe.complete?.();
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    });
    expect(patches).toBe(0);
  } finally {
    await owned.close();
  }
});

test('location writes check authoritative ownership, payload bounds and missing or expired sessions', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 242);
  try {
    const { db, contexts, people } = owned;
    const path = '/api/profile/location';
    const payload = { latitude: 0, longitude: 0, expectedUserId: people[0] };
    expect((await request.patch(path, { data: payload })).status()).toBe(401);
    expect(
      (
        await contexts[0].request.patch(path, { data: { ...payload, expectedUserId: people[1] } })
      ).status(),
    ).toBe(409);
    for (const invalid of [
      { latitude: 91 },
      { longitude: 181 },
      { latitude: '0' },
      { latitude: null },
    ])
      expect(
        (await contexts[0].request.patch(path, { data: { ...payload, ...invalid } })).status(),
      ).toBe(400);
    expect(
      (
        await contexts[0].request.patch(path, {
          headers: { 'Content-Type': 'application/json' },
          data: Buffer.from('{'),
        })
      ).status(),
    ).toBe(400);
    expect(
      (await contexts[0].request.patch(path, { data: { ...payload, userId: people[1] } })).status(),
    ).toBe(200);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).latitude).toBe(0);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).latitude,
    ).toBeNull();
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect((await contexts[0].request.patch(path, { data: payload })).status()).toBe(401);
  } finally {
    await owned.close();
  }
});
