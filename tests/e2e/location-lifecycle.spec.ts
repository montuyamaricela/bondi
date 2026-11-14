import { randomInt, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import { LOCATION_CATALOG_ID, normalizeCityName } from '../../lib/location-catalog';

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
async function fixture(browser: Browser, baseURL: string, ip: number, withCities = false) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-location`;
  const contexts: BrowserContext[] = [];
  const people: string[] = [];
  const cityName = `Synthetic city ${randomUUID().slice(0, 8)}`;
  const cityIds = [
    String(900_000_000 + randomInt(40_000_000)),
    String(950_000_000 + randomInt(40_000_000)),
  ];
  let catalogCreated = false;
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
      await db.locationCity.deleteMany({ where: { id: { in: cityIds }, sourceVersion: prefix } });
      if (catalogCreated)
        await db.locationCatalog.deleteMany({
          where: { id: LOCATION_CATALOG_ID, version: prefix },
        });
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
    if (withCities) {
      if (!(await db.locationCatalog.findUnique({ where: { id: LOCATION_CATALOG_ID } }))) {
        await db.locationCatalog.create({
          data: { id: LOCATION_CATALOG_ID, version: prefix, checksums: {}, cityCount: 2 },
        });
        catalogCreated = true;
      }
      await db.locationCity.createMany({
        data: cityIds.map((id, index) => ({
          id,
          name: cityName,
          region: index ? 'Beta' : 'Alpha',
          country: index ? 'United States' : 'Philippines',
          countryCode: index ? 'US' : 'PH',
          latitude: 0,
          longitude: 0,
          sourceVersion: prefix,
        })),
      });
      await db.locationCityName.createMany({
        data: cityIds.map((cityId) => ({ cityId, normalizedName: normalizeCityName(cityName) })),
      });
    }
    return { db, contexts, people, cityName, cityIds, close };
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
const lastKnown = (page: Page) => page.getByText('Last known device location', { exact: true });

test('logout discards a deferred device capture before another account signs in', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 212);
  try {
    const { contexts, people, db } = owned;
    const email = (await contexts[1].request.get('/api/auth/get-session').then((r) => r.json()))
      .user.email;
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.evaluate(() => {
      window.locationProbe.mode = 'deferred';
    });
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.locationProbe.calls)).toBe(1);
    await page.getByRole('button', { name: 'Location owner 0' }).click();
    await page.getByRole('menuitem', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill('SyntheticLocation35!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/discover/);
    await page.getByRole('button', { name: 'Location owner 1' }).click();
    await page.getByRole('menuitem', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
    await page.evaluate(() => window.locationProbe.complete?.());
    await expect(page.getByText('Location is off.', { exact: true })).toBeVisible();
    for (const userId of people)
      expect(await db.profile.findUniqueOrThrow({ where: { userId } })).toMatchObject({
        locationMode: 'OFF',
        locationRevision: 0,
        latitude: null,
        longitude: null,
      });
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.evaluate(() => {
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(2);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).toMatchObject({
      locationMode: 'DEVICE',
      locationRevision: 1,
      latitude: 0,
      longitude: 0,
    });
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 0,
      latitude: null,
      longitude: null,
    });
  } finally {
    await owned.close();
  }
});

test('a stale clear refetches the committed city and requires a fresh explicit clear', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 214, true);
  let release: (() => void) | undefined;
  try {
    const { contexts, people, db, cityIds, cityName } = owned;
    const page = await contexts[0].newPage();
    await page.goto('/settings');
    await expect(page.getByRole('radio', { name: 'Off', exact: true })).toBeChecked();
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let clears = 0;
    await page.route('**/api/profile/location', async (route) => {
      if (route.request().method() !== 'PATCH' || route.request().postDataJSON().action !== 'CLEAR')
        return route.continue();
      clears++;
      if (clears === 1) await held;
      await route.fulfill({ response: await route.fetch() });
    });
    await page.getByRole('button', { name: 'Clear saved location', exact: true }).click();
    await expect.poll(() => clears).toBe(1);
    expect(
      (
        await contexts[0].request.patch('/api/profile/location', {
          data: {
            action: 'CITY',
            expectedUserId: people[0],
            expectedRevision: 0,
            cityId: cityIds[0],
          },
        })
      ).status(),
    ).toBe(200);
    release?.();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Location changed. Review the saved settings' }),
    ).toBeVisible();
    await expect(
      page.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    expect(clears).toBe(1);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 1,
      locationCityId: cityIds[0],
    });
    await page.getByRole('button', { name: 'Clear saved location', exact: true }).click();
    await expect(page.getByText('Location cleared.', { exact: true })).toBeVisible();
    expect(clears).toBe(2);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 2,
      locationCityId: null,
    });
  } finally {
    release?.();
    await owned.close();
  }
});

async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  for (let index = 0; index < 60; index++) {
    if (await target.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('The location control was not reachable by keyboard');
}

test('discovery never requests location automatically and an explicit save refreshes its cached feed without reload', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 234);
  try {
    const { db, contexts, people } = owned;
    await db.profile.update({
      where: { userId: people[1] },
      data: {
        locationMode: 'DEVICE',
        showDistance: true,
        latitude: 0,
        longitude: 0,
        lastLocationUpdate: new Date(),
      },
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
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    const saved = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    expect(saved.latitude).toBe(0);
    expect(saved.longitude).toBe(0);
    expect(saved.lastLocationUpdate).not.toBeNull();
    await expect(page.locator('time')).toHaveAttribute(
      'datetime',
      saved.lastLocationUpdate!.toISOString(),
    );
    await expect(
      page.getByRole('button', { name: 'Refresh device location', exact: true }),
    ).toBeEnabled();
    expect(await page.evaluate(() => window.locationProbe.options)).toMatchObject({
      maximumAge: 0,
      enableHighAccuracy: false,
      timeout: 10000,
    });
    await page.getByRole('link', { name: 'Discover', exact: true }).click();
    await expect(
      page.getByText(/Less than 1 km away; estimated from last-known locations/),
    ).toBeVisible();
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
      await page.getByRole('radio', { name: 'Device location', exact: true }).check();
      await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Enable device location', exact: true }),
      ).toBeEnabled();
    }
    await page.evaluate(() =>
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: undefined }),
    );
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
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
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: /requires a secure connection/ }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(3);
    await page.evaluate(() => {
      Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
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
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
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
    await expect(
      page.getByRole('button', { name: 'Refresh device location', exact: true }),
    ).toBeEnabled();
    // Saved zero coordinates remain last-known on a new mount, without another request.
    await page.reload();
    await expect(lastKnown(page)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Refresh device location', exact: true }),
    ).toBeEnabled();
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
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
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
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await expect(
      page.getByRole('button', { name: 'Enable device location', exact: true }),
    ).toBeEnabled();
    await expect(page.getByRole('alert').filter({ hasText: /account changed/ })).toHaveCount(0);
    await page.evaluate(() => {
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).latitude).toBe(0);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).latitude,
    ).toBeNull();
    await page.evaluate(() => {
      window.locationProbe.mode = 'deferred';
    });
    await page.getByRole('button', { name: 'Refresh device location', exact: true }).click();
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
    const payload = {
      action: 'DEVICE',
      expectedRevision: 0,
      latitude: 0,
      longitude: 0,
      expectedUserId: people[0],
    };
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
    ).toBe(400);
    expect((await contexts[0].request.patch(path, { data: payload })).status()).toBe(200);
    expect((await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).latitude).toBe(0);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1] } })).latitude,
    ).toBeNull();
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect(
      (
        await contexts[0].request.patch(path, { data: { ...payload, expectedRevision: 1 } })
      ).status(),
    ).toBe(401);
  } finally {
    await owned.close();
  }
});

test('keyboard city selection, independent visibility and clear replace device data without automatic permission', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 244, true);
  const trigger = `bondi_e2e_clear_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, contexts, people, cityName, cityIds } = owned;
    await db.profile.update({
      where: { userId: people[0] },
      data: {
        locationMode: 'DEVICE',
        latitude: 0,
        longitude: 0,
        lastLocationUpdate: null,
        location: 'Synthetic unconfirmed legacy label',
      },
    });
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    const center = page.getByRole('region', { name: 'Location Control Center', exact: true });
    const preview = page.getByRole('region', { name: 'Discovery location preview', exact: true });
    await expect(lastKnown(page)).toBeVisible();
    await expect(center.getByText('Last updated: Unknown', { exact: true })).toBeVisible();
    await expect(center.getByText(/Unconfirmed legacy label:/)).toBeVisible();
    const device = page.getByRole('radio', { name: 'Device location', exact: true });
    await tabTo(page, device);
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('radio', { name: 'City-only', exact: true })).toBeChecked();
    await page.getByLabel('Search city', { exact: true }).fill(cityName);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).locationMode,
    ).toBe('DEVICE');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('radio', { name: `${cityName}, Alpha, Philippines`, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('radio', { name: `${cityName}, Beta, United States`, exact: true }),
    ).toBeVisible();
    await page.getByLabel('Country code (optional)', { exact: true }).fill('PH');
    await page.keyboard.press('Enter');
    const city = page.getByRole('radio', { name: `${cityName}, Alpha, Philippines`, exact: true });
    await expect(
      page.getByRole('radio', { name: `${cityName}, Beta, United States`, exact: true }),
    ).toHaveCount(0);
    await tabTo(page, city);
    await page.keyboard.press('Space');
    const save = page.getByRole('button', { name: 'Save city', exact: true });
    await tabTo(page, save);
    await page.keyboard.press('Enter');
    await expect(
      page.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 1,
      locationCityId: cityIds[0],
      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
      location: null,
      showCity: false,
      showDistance: false,
    });
    await expect(preview).toContainText('No city label visible');
    await expect(preview).toContainText('Distance hidden');
    const showCity = page.getByRole('checkbox', { name: 'Show selected city', exact: true });
    const showDistance = page.getByRole('checkbox', {
      name: 'Show approximate distance',
      exact: true,
    });
    await tabTo(page, showCity);
    await page.keyboard.press('Space');
    await expect(showCity).toBeChecked();
    await expect(showCity).toBeEnabled();
    await expect(preview).toContainText(`${cityName}, Alpha, Philippines`);
    await expect(preview).toContainText('Distance hidden');
    await tabTo(page, showDistance);
    await page.keyboard.press('Space');
    await expect(showDistance).toBeChecked();
    await expect(showDistance).toBeEnabled();
    await expect(preview).toContainText('Distance visible to eligible viewers; approximate');
    await tabTo(page, showCity);
    await page.keyboard.press('Space');
    await expect(showCity).not.toBeChecked();
    await expect(showCity).toBeEnabled();
    await expect(preview).toContainText('No city label visible');
    await expect(showDistance).toBeChecked();
    const beforeClear = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    expect(beforeClear.locationRevision).toBe(4);
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."userId" = '${people[0]}' THEN RAISE EXCEPTION 'synthetic clear failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const clear = page.getByRole('button', { name: 'Clear saved location', exact: true });
    await tabTo(page, clear);
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Location could not be cleared' }),
    ).toBeVisible();
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toEqual(
      beforeClear,
    );
    await expect(
      page.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    await removeFailure();
    await page.evaluate(
      (userId) =>
        localStorage.setItem(
          `profile-setup-form:${encodeURIComponent(userId)}`,
          JSON.stringify({
            timestamp: 123,
            data: {
              name: 'Synthetic retained draft',
              location: 'Synthetic draft city',
              latitude: 0,
              longitude: 0,
              locationCityId: 'synthetic-old-city',
              interests: ['Synthetic retained interest'],
            },
          }),
        ),
      people[0],
    );
    await tabTo(page, clear);
    await page.keyboard.press('Enter');
    await expect(center.getByText('Location is off.', { exact: true })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Location cleared.' })).toBeVisible();
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 5,
      locationCityId: null,
      cityLocationUpdate: null,
      latitude: null,
      longitude: null,
      lastLocationUpdate: null,
      location: null,
      showCity: false,
      showDistance: false,
    });
    const draft = await page.evaluate(
      (userId) =>
        JSON.parse(localStorage.getItem(`profile-setup-form:${encodeURIComponent(userId)}`)!),
      people[0],
    );
    expect(draft).toEqual({
      timestamp: 123,
      data: { name: 'Synthetic retained draft', interests: ['Synthetic retained interest'] },
    });
    const nonce = await page.evaluate(() => localStorage.getItem('bondi:location-change'));
    const parts = nonce!.split(':');
    expect(parts).toHaveLength(2);
    expect(Number.isInteger(Number(parts[0]))).toBe(true);
    expect(Number(parts[1])).toBeGreaterThanOrEqual(0);
    expect(Number(parts[1])).toBeLessThan(1);
    await expect(showCity).not.toBeChecked();
    await expect(showDistance).not.toBeChecked();
    await page.getByRole('radio', { name: 'City-only', exact: true }).check();
    await expect(page.getByLabel('Search city', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save city', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(1);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'DEVICE',
      locationRevision: 6,
      locationCityId: null,
      cityLocationUpdate: null,
      latitude: 0,
      longitude: 0,
      showCity: false,
      showDistance: false,
    });
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('another tab replaces a held device save, and clearing keeps an open discovery radius actionable', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 246, true);
  let release: (() => void) | undefined;
  try {
    const { db, contexts, people, cityName } = owned;
    const marker = `location-${randomUUID()}`;
    await db.profile.updateMany({
      where: { userId: { in: people } },
      data: {
        interests: [marker],
        hobbies: [marker],
        locationMode: 'DEVICE',
        latitude: 0,
        longitude: 0,
        lastLocationUpdate: new Date(),
        showDistance: true,
      },
    });
    const first = await contexts[0].newPage();
    const second = await contexts[0].newPage();
    await installGeolocation(first);
    await installGeolocation(second);
    await first.goto('/settings');
    await second.goto('/settings');
    let held = false;
    await first.route('**/api/profile/location', async (route) => {
      if (
        route.request().method() !== 'PATCH' ||
        route.request().postDataJSON().action !== 'DEVICE'
      )
        return route.continue();
      const saved = await route.fetch();
      expect(saved.status()).toBe(200);
      held = true;
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await route.fulfill({ response: saved }).catch(() => {});
    });
    await first.getByRole('button', { name: 'Refresh device location', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).locationRevision,
    ).toBe(1);
    await second.reload();
    await expect(lastKnown(second)).toBeVisible();
    await second.getByRole('radio', { name: 'City-only', exact: true }).check();
    await second.getByLabel('Search city', { exact: true }).fill(cityName);
    await second.getByRole('button', { name: 'Search cities', exact: true }).click();
    await second
      .getByRole('radio', { name: `${cityName}, Alpha, Philippines`, exact: true })
      .check();
    await second.getByRole('button', { name: 'Save city', exact: true }).click();
    await expect(
      second.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    await expect(
      first.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    release?.();
    release = undefined;
    await expect(lastKnown(first)).toHaveCount(0);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 2,
      latitude: null,
      longitude: null,
    });
    const discovery = await contexts[0].newPage();
    await installGeolocation(discovery);
    await discovery.goto('/discover');
    await expect(
      discovery.getByRole('heading', { name: 'Location owner 1, 28', exact: true }),
    ).toBeVisible();
    await discovery.getByRole('button', { name: 'Filters', exact: true }).click();
    await discovery.getByRole('slider').nth(2).press('Home');
    await discovery.getByRole('button', { name: 'Apply Filters', exact: true }).click();
    await expect(discovery.getByText(/Approximate:.*selected city center/)).toBeVisible();
    const reads: Array<{ distance: string | null; status: number }> = [];
    discovery.on('response', (response) => {
      const url = new URL(response.url());
      if (url.pathname === '/api/discover' && response.request().method() === 'GET')
        reads.push({ distance: url.searchParams.get('distance'), status: response.status() });
    });
    await second.getByRole('button', { name: 'Clear saved location', exact: true }).click();
    await expect(second.getByText('Location is off.', { exact: true })).toBeVisible();
    await expect(first.getByText('Location is off.', { exact: true })).toBeVisible();
    await discovery.bringToFront();
    await expect(
      discovery
        .getByRole('alert')
        .filter({ hasText: 'Enable device location or select an available city' }),
    ).toBeVisible();
    expect(reads.some((read) => read.distance === '1' && read.status === 422)).toBe(true);
    expect(reads.every((read) => read.distance === '1')).toBe(true);
    await discovery.getByRole('button', { name: 'Remove distance filter', exact: true }).click();
    await expect(
      discovery
        .getByRole('alert')
        .filter({ hasText: 'Enable device location or select an available city' }),
    ).toHaveCount(0);
    await expect(discovery.getByText(/Approximate:.*selected city center/)).toHaveCount(0);
    await expect(
      discovery.getByRole('heading', { name: 'Location owner 1, 28', exact: true }),
    ).toBeVisible();
    expect(await first.evaluate(() => window.locationProbe.calls)).toBe(1);
    expect(await second.evaluate(() => window.locationProbe.calls)).toBe(0);
    expect(await discovery.evaluate(() => window.locationProbe.calls)).toBe(0);
  } finally {
    release?.();
    await owned.close();
  }
});

test('late captures and failed-save fixes are discarded when city selection or clear supersedes them', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 248, true);
  const trigger = `bondi_e2e_fix_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await owned.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await owned.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, contexts, people, cityName } = owned;
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    let deviceWrites = 0;
    page.on('request', (request) => {
      if (
        new URL(request.url()).pathname === '/api/profile/location' &&
        request.method() === 'PATCH' &&
        request.postDataJSON().action === 'DEVICE'
      )
        deviceWrites++;
    });
    const releaseCapture = () =>
      page.evaluate(async () => {
        window.locationProbe.complete?.();
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
      });
    const selectCity = async () => {
      await page.getByRole('radio', { name: 'City-only', exact: true }).check();
      await page.getByLabel('Search city', { exact: true }).fill(cityName);
      await page.getByRole('button', { name: 'Search cities', exact: true }).click();
      await page
        .getByRole('radio', { name: `${cityName}, Alpha, Philippines`, exact: true })
        .check();
      await page.getByRole('button', { name: 'Save city', exact: true }).click();
      await expect(
        page.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
      ).toBeVisible();
    };
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.evaluate(() => {
      window.locationProbe.mode = 'deferred';
    });
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.locationProbe.calls)).toBe(1);
    await selectCity();
    await releaseCapture();
    expect(deviceWrites).toBe(0);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 1,
      latitude: null,
      longitude: null,
    });
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.locationProbe.calls)).toBe(2);
    await page.getByRole('button', { name: 'Clear saved location', exact: true }).click();
    await expect(page.getByText('Location is off.', { exact: true })).toBeVisible();
    await releaseCapture();
    expect(deviceWrites).toBe(0);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 2,
      latitude: null,
      longitude: null,
      locationCityId: null,
    });
    expect(people[0]).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD."userId" = '${people[0]}' AND NEW."locationMode" = 'DEVICE' THEN RAISE EXCEPTION 'synthetic fix save failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.evaluate(() => {
      window.locationProbe.mode = 'success';
    });
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(3);
    await removeFailure();
    await selectCity();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toHaveCount(0);
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await expect(page.getByRole('button', { name: 'Retry save', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(3);
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(lastKnown(page)).toBeVisible();
    expect(deviceWrites).toBe(2);
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(4);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'DEVICE',
      locationRevision: 4,
      latitude: 0,
      longitude: 0,
      locationCityId: null,
    });
  } finally {
    await removeFailure();
    await owned.close();
  }
});

test('city coverage gaps, catalog outages and unavailable selections do not replace the saved origin', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 250, true);
  const temporaryId = `synthetic-outage-${randomUUID()}`;
  let renamed = false;
  try {
    const { db, contexts, people, cityName, cityIds } = owned;
    const page = await contexts[0].newPage();
    await installGeolocation(page);
    await page.goto('/settings');
    await page.getByRole('radio', { name: 'City-only', exact: true }).check();
    await page.getByLabel('Search city', { exact: true }).fill(`No listed city ${randomUUID()}`);
    await page.getByRole('button', { name: 'Search cities', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'No listed cities found' }),
    ).toBeVisible();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).locationRevision,
    ).toBe(0);
    await db.locationCatalog.update({
      where: { id: LOCATION_CATALOG_ID },
      data: { id: temporaryId },
    });
    renamed = true;
    await page
      .getByLabel('Search city', { exact: true })
      .fill(cityName.replace('Synthetic', 'SýnThétic'));
    await page.getByRole('button', { name: 'Search cities', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'City search is temporarily unavailable' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'No listed cities found' }),
    ).toHaveCount(0);
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'OFF',
      locationRevision: 0,
      latitude: null,
      longitude: null,
      locationCityId: null,
    });
    await db.locationCatalog.update({
      where: { id: temporaryId },
      data: { id: LOCATION_CATALOG_ID },
    });
    renamed = false;
    await page.getByRole('button', { name: 'Retry city search', exact: true }).click();
    await expect(
      page.getByRole('radio', { name: `${cityName}, Beta, United States`, exact: true }),
    ).toBeVisible();
    await page.getByLabel('Country code (optional)', { exact: true }).fill('US');
    await page.getByRole('button', { name: 'Search cities', exact: true }).click();
    await page
      .getByRole('radio', { name: `${cityName}, Beta, United States`, exact: true })
      .check();
    await page.getByRole('button', { name: 'Save city', exact: true }).click();
    await expect(
      page.getByText(`Selected city: ${cityName}, Beta, United States`, { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
    const cityBeforeFailure = await db.profile.findUniqueOrThrow({ where: { userId: people[0] } });
    await page.getByRole('radio', { name: 'Device location', exact: true }).check();
    await page.evaluate(() => {
      window.locationProbe.mode = 'error';
      window.locationProbe.code = 1;
    });
    await page.getByRole('button', { name: 'Enable device location', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Location permission denied' }),
    ).toBeVisible();
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toEqual(
      cityBeforeFailure,
    );
    await db.$transaction([
      db.locationCity.update({ where: { id: cityIds[1] }, data: { available: false } }),
      db.profile.updateMany({
        where: { locationCityId: cityIds[1] },
        data: { locationRevision: { increment: 1 } },
      }),
    ]);
    await page.reload();
    await expect(
      page.getByRole('alert').filter({ hasText: 'This city is unavailable' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: 'Discovery location preview' })).toContainText(
      'Distance unavailable',
    );
    expect((await contexts[0].request.get('/api/discover?distance=1')).status()).toBe(422);
    expect((await contexts[0].request.get('/api/discover')).status()).toBe(200);
    await page.getByLabel('Search city', { exact: true }).fill(cityName);
    await page.getByRole('button', { name: 'Search cities', exact: true }).click();
    await expect(
      page.getByRole('radio', { name: `${cityName}, Beta, United States`, exact: true }),
    ).toHaveCount(0);
    await page.getByRole('radio', { name: `${cityName}, Alpha, Philippines`, exact: true }).check();
    await page.getByRole('button', { name: 'Save city', exact: true }).click();
    await expect(
      page.getByText(`Selected city: ${cityName}, Alpha, Philippines`, { exact: true }),
    ).toBeVisible();
    expect(await db.profile.findUniqueOrThrow({ where: { userId: people[0] } })).toMatchObject({
      locationMode: 'CITY',
      locationRevision: 3,
      locationCityId: cityIds[0],
      latitude: null,
      longitude: null,
    });
    expect(await page.evaluate(() => window.locationProbe.calls)).toBe(0);
  } finally {
    if (renamed)
      await owned.db.locationCatalog.update({
        where: { id: temporaryId },
        data: { id: LOCATION_CATALOG_ID },
      });
    await owned.close();
  }
});
