import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const password = 'SyntheticPresence26!';

function testDatabase() {
  assertTestDatabase();
}

async function participants(browser: Browser, baseURL: string, db: PrismaClient, offset: number) {
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  const people: Array<{ id: string; email: string }> = [];
  try {
    for (const [index, name] of ['Observer', 'Target', 'Outsider', 'Former'].entries()) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${offset + index}` },
      });
      contexts.push(context);
      const email = `bondi-e2e-${randomUUID()}-presence@example.test`;
      emails.push(email);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email, password, name },
      });
      expect(response.status()).toBe(200);
      const id = (await response.json()).user.id;
      await db.profile.create({
        data: {
          userId: id,
          name,
          age: 28,
          bio: 'Synthetic presence fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: true,
        },
      });
      people.push({ id, email });
    }
    const match = await db.match.create({ data: { user1Id: people[0].id, user2Id: people[1].id } });
    await db.match.create({
      data: { user1Id: people[3].id, user2Id: people[1].id, status: 'UNMATCHED' },
    });
    return { contexts, emails, people, match };
  } catch (error) {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await db.user.deleteMany({ where: { email: { in: emails } } });
    throw error;
  }
}

async function privacyFixture(browser: Browser, baseURL: string, offset: number) {
  testDatabase();
  const db = new PrismaClient();
  let fixture: Awaited<ReturnType<typeof participants>> | undefined;
  const close = async () => {
    if (!fixture) return db.$disconnect();
    await Promise.allSettled(fixture.contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { in: fixture.emails } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    fixture = await participants(browser, baseURL, db, offset);
    await db.profile.update({
      where: { userId: fixture.people[1].id },
      data: { showOnlineStatus: false },
    });
    return {
      ...fixture,
      db,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}

async function failPrivacyWrites(db: PrismaClient, userId: string) {
  expect(userId).toMatch(/^[A-Za-z0-9_-]+$/);
  const trigger = `bondi_e2e_privacy_${randomUUID().replaceAll('-', '')}`;
  const remove = async () => {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Profile"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${userId}' AND NEW."showOnlineStatus" IS DISTINCT FROM OLD."showOnlineStatus" THEN RAISE EXCEPTION 'synthetic privacy write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "Profile" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    return remove;
  } catch (error) {
    await remove();
    throw error;
  }
}

test('open chat and inbox show initial presence, aggregate tabs and retract privacy changes', async ({
  browser,
  baseURL,
}) => {
  testDatabase();
  const db = new PrismaClient();
  let fixture: Awaited<ReturnType<typeof participants>> | undefined;
  try {
    fixture = await participants(browser, baseURL!, db, 144);
    const { contexts, people, match } = fixture;
    const firstTab = await contexts[1].newPage();
    await firstTab.goto('/settings');
    const viewer = await contexts[0].newPage();
    await viewer.goto(`/messages/${match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(1);
    const secondTab = await contexts[1].newPage();
    await secondTab.goto('/settings');
    await expect(
      secondTab.getByRole('checkbox', { name: 'Show Online Status', exact: true }),
    ).toBeChecked();
    await firstTab.close();
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    for (const visible of [false, true]) {
      const control = secondTab.getByRole('checkbox', { name: 'Show Online Status', exact: true });
      await expect(control).toBeEnabled();
      await control.focus();
      await control.press('Space');
      if (visible) await expect(control).toBeChecked();
      else await expect(control).not.toBeChecked();
      await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(visible ? 1 : 0);
      await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(visible ? 1 : 0);
      if (!visible) await expect(viewer.getByText('Offline', { exact: true })).toHaveCount(0);
    }
    await viewer.goto('/messages');
    await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(1);
    await viewer.goto(`/messages/${match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await secondTab.close();
    await expect(viewer.getByText('Offline', { exact: true })).toBeVisible();
    await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(0);
    const thirdTab = await contexts[1].newPage();
    await thirdTab.goto('/settings');
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'More options', exact: true }).click();
    await viewer.getByRole('menuitem', { name: 'Unmatch', exact: true }).click();
    await viewer.getByRole('dialog').getByRole('button', { name: 'Unmatch', exact: true }).click();
    await expect(
      viewer.getByText('This match has ended. You can still read the conversation.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(0);
    const status = await contexts[0].request.post('/api/users/online-status', {
      data: { userIds: [people[1].id] },
    });
    expect(await status.json()).toEqual({ [people[1].id]: false });
  } finally {
    if (fixture) {
      await Promise.allSettled(fixture.contexts.map((context) => context.close()));
      await db.user.deleteMany({ where: { email: { in: fixture.emails } } });
    }
    await db.$disconnect();
  }
});

test('online privacy serializes rapid toggles and the last accepted disable stays private', async ({
  browser,
  baseURL,
}) => {
  const owned = await privacyFixture(browser, baseURL!, 156);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let entered = () => {};
  const pending = new Promise<void>((resolve) => {
    entered = resolve;
  });
  try {
    const { contexts, db, people, match } = owned;
    const target = await contexts[1].newPage();
    await target.goto('/settings');
    const viewer = await contexts[0].newPage();
    await viewer.goto(`/messages/${match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    let writes = 0;
    await target.route('**/api/profile/privacy', async (route) => {
      writes++;
      if (writes === 1) {
        entered();
        await held;
      }
      const response = await route.fetch();
      await route.fulfill({ response });
    });
    const control = target.getByRole('checkbox', { name: 'Show Online Status', exact: true });
    await expect(control).not.toBeChecked();
    await control.focus();
    await control.press('Space');
    await pending;
    await expect(control).toBeDisabled();
    await target.keyboard.press('Space');
    await target.keyboard.press('Space');
    expect(writes).toBe(1);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(false);
    release();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(true);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    expect(
      await (
        await contexts[2].request.post('/api/users/online-status', {
          data: { userIds: [people[1].id] },
        })
      ).json(),
    ).toEqual({ [people[1].id]: false });
    await control.focus();
    await control.press('Space');
    await expect(control).toBeEnabled();
    await expect(control).not.toBeChecked();
    expect(writes).toBe(2);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(false);
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    await target.reload();
    await expect(control).not.toBeChecked();
  } finally {
    release();
    await owned.close();
  }
});

test('privacy failures roll back and retry uses the returned canonical value', async ({
  browser,
  baseURL,
}) => {
  const owned = await privacyFixture(browser, baseURL!, 160);
  let removeFailure = async () => {};
  try {
    const { contexts, people, db } = owned;
    removeFailure = await failPrivacyWrites(db, people[1].id);
    const page = await contexts[1].newPage();
    await page.goto('/settings');
    const control = page.getByRole('checkbox', { name: 'Show Online Status', exact: true });
    const current = await (await contexts[1].request.get('/api/auth/get-session')).json();
    const failed = page.waitForResponse((response) =>
      response.url().endsWith('/api/profile/privacy'),
    );
    await control.focus();
    await control.press('Space');
    const response = await failed;
    expect(response.status()).toBe(500);
    expect(response.request().postDataJSON()).toMatchObject({
      expectedUserId: people[1].id,
      expectedSessionId: current.session.id,
    });
    await expect(control).toBeEnabled();
    await expect(control).not.toBeChecked();
    await expect(
      page.getByRole('button', { name: 'Refresh privacy setting', exact: true }),
    ).toBeVisible();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(false);
    await removeFailure();

    // A controlled reply carries the canonical result of a subsequent real write.
    await page.route('**/api/profile/privacy', async (route) => {
      expect((await route.fetch()).status()).toBe(200);
      const canonical = await contexts[1].request.patch('/api/profile/privacy', {
        data: {
          showOnlineStatus: false,
          expectedUserId: people[1].id,
          expectedSessionId: current.session.id,
        },
      });
      expect(canonical.status()).toBe(200);
      await route.fulfill({
        status: canonical.status(),
        contentType: 'application/json',
        body: await canonical.text(),
      });
    });
    await control.focus();
    await control.press('Space');
    await expect(control).toBeEnabled();
    await expect(control).not.toBeChecked();
    await expect(
      page.getByRole('button', { name: 'Refresh privacy setting', exact: true }),
    ).toHaveCount(0);
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(false);
    await page.unroute('**/api/profile/privacy');
    await control.focus();
    await control.press('Space');
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(true);
    await page.route('**/api/profile/privacy', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await control.focus();
    await control.press('Space');
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked();
    await expect(
      page.getByRole('button', { name: 'Refresh privacy setting', exact: true }),
    ).toBeVisible();
    expect(
      (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
    ).toBe(true);
    await page.getByRole('button', { name: 'Refresh privacy setting', exact: true }).click();
    await expect(control).toBeChecked();
    await expect(
      page.getByRole('button', { name: 'Refresh privacy setting', exact: true }),
    ).toHaveCount(0);
  } finally {
    try {
      await removeFailure();
    } finally {
      await owned.close();
    }
  }
});

for (const [index, replacement] of ['account', 'session', 'logout'].entries()) {
  test(`an old privacy failure cannot affect settings after ${replacement} replacement`, async ({
    browser,
    baseURL,
  }) => {
    const owned = await privacyFixture(browser, baseURL!, 164 + index * 4);
    let removeFailure = async () => {};
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered = () => {};
    const pending = new Promise<void>((resolve) => {
      entered = resolve;
    });
    try {
      const { contexts, people, db } = owned;
      removeFailure = await failPrivacyWrites(db, people[1].id);
      const page = await contexts[1].newPage();
      await page.goto('/settings');
      await page.route('**/api/profile/privacy', async (route) => {
        const response = await route.fetch();
        expect(response.status()).toBe(500);
        entered();
        await held;
        if (!route.request().failure()) await route.fulfill({ response });
      });
      const control = page.getByRole('checkbox', { name: 'Show Online Status', exact: true });
      await control.focus();
      await control.press('Space');
      await pending;
      const cancelled = page.waitForEvent('requestfailed', {
        predicate: (request) => request.url().endsWith('/api/profile/privacy'),
      });
      if (replacement === 'account') {
        await contexts[1].clearCookies();
        await contexts[1].addCookies(await contexts[2].cookies());
      } else if (replacement === 'session') {
        const previous = await (await contexts[1].request.get('/api/auth/get-session')).json();
        expect(
          (
            await contexts[1].request.post('/api/auth/sign-in/email', {
              headers: { Origin: baseURL! },
              data: { email: people[1].email, password },
            })
          ).status(),
        ).toBe(200);
        const renewed = await (await contexts[1].request.get('/api/auth/get-session')).json();
        expect(renewed.session.id).not.toBe(previous.session.id);
      } else {
        expect(
          (
            await contexts[1].request.post('/api/auth/sign-out', {
              headers: { Origin: baseURL! },
              data: {},
            })
          ).status(),
        ).toBe(200);
      }
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      if (replacement === 'logout') await expect(page).toHaveURL(/\/login(?:\?|$)/);
      else {
        await expect(control).toBeEnabled();
        if (replacement === 'account') {
          await expect(page.getByText(people[2].email, { exact: true })).toBeVisible();
          await expect(control).toBeChecked();
        } else await expect(control).not.toBeChecked();
      }
      expect((await cancelled).failure()?.errorText).toContain('ABORTED');
      release();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      await expect(
        page.getByText('Could not confirm your privacy setting. Refresh to check.', {
          exact: true,
        }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: 'Refresh privacy setting', exact: true }),
      ).toHaveCount(0);
      expect(
        (await db.profile.findUniqueOrThrow({ where: { userId: people[1].id } })).showOnlineStatus,
      ).toBe(false);
      expect(
        (await db.profile.findUniqueOrThrow({ where: { userId: people[2].id } })).showOnlineStatus,
      ).toBe(true);
    } finally {
      release();
      try {
        await removeFailure();
      } finally {
        await owned.close();
      }
    }
  });
}
