import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';

async function fixture(browser: Browser, baseURL: string, ip: number, count = 1) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-history-error`;
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
    const signup = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL },
      data: {
        email: `${prefix}@example.test`,
        name: 'History viewer',
        password: 'SyntheticHistory27!',
      },
    });
    expect(signup.status()).toBe(200);
    const viewer: string = (await signup.json()).user.id;
    const peer = `${prefix}-peer`;
    await db.user.create({
      data: { id: peer, email: `${peer}@example.test`, name: 'History peer' },
    });
    for (const userId of [viewer, peer])
      await db.profile.create({
        data: {
          userId,
          name: userId === viewer ? 'History viewer' : 'History peer',
          age: 28,
          bio: 'Synthetic chat history fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
    const match = await db.match.create({ data: { user1Id: viewer, user2Id: peer } });
    const seed = async (size: number) =>
      db.message.createMany({
        data: Array.from({ length: size }, (_, index) => ({
          id: `${prefix}-${String(index).padStart(3, '0')}`,
          matchId: match.id,
          senderId: viewer,
          content: `Saved history ${String(index).padStart(3, '0')}`,
          createdAt: new Date('2001-01-01T00:00:00Z'),
        })),
      });
    await seed(count);
    return { db, context, viewer, peer, match, seed, close };
  } catch (error) {
    await close();
    throw error;
  }
}

for (const failure of ['503', 'network'] as const)
  test(`initial ${failure} history failure is recoverable without losing the draft`, async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    const owned = await fixture(browser, baseURL!, failure === '503' ? 232 : 233);
    let release = () => {};
    try {
      const { context, match, db } = owned;
      const page = await context.newPage();
      // Keep explicit history retry independent of native typing/presence refreshes.
      await page.routeWebSocket('**/realtime/v1/websocket**', (socket) => socket.close());
      let fail = true;
      let retryRequests = 0;
      let held = false;
      await page.route('**/api/messages?*', async (route) => {
        if (fail) {
          if (failure === 'network') await route.abort('connectionfailed');
          else await route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } });
          return;
        }
        retryRequests++;
        const response = await route.fetch();
        if (!held) {
          held = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        await route.fulfill({ response });
      });
      await page.goto(`/messages/${match.id}`);
      const log = page.getByRole('log', { name: 'Conversation messages' });
      await expect(log.getByRole('alert')).toContainText('Could not load messages', {
        timeout: 20_000,
      });
      await expect(log.getByText('No messages yet. Start the conversation!')).toHaveCount(0);
      const draft = 'Keep this draft while history retries';
      const input = page.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill(draft);
      fail = false;
      const retry = log.getByRole('button', { name: 'Retry messages', exact: true });
      await retry.click();
      await expect.poll(() => held).toBe(true);
      await expect(retry).toHaveCount(0);
      await expect(log.getByRole('status', { name: 'Loading messages' })).toBeVisible();
      await expect(input).toHaveValue(draft);
      await expect(input).toBeEnabled();
      release();
      await expect(log.getByText('Saved history 000', { exact: true })).toHaveCount(1);
      await expect(log.getByRole('alert')).toHaveCount(0);
      await expect(input).toHaveValue(draft);
      expect(retryRequests).toBe(1);
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect(input).toHaveValue('');
      await expect(log.getByText(draft, { exact: true })).toHaveCount(1);
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(2);
    } finally {
      release();
      await owned.close();
    }
  });

test('successful empty history and older-page failures remain distinct', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const owned = await fixture(browser, baseURL!, 234, 0);
  try {
    const { context, match, seed } = owned;
    const page = await context.newPage();
    await page.goto(`/messages/${match.id}`);
    const log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.getByText('No messages yet. Start the conversation!')).toBeVisible();
    await expect(log.getByRole('alert')).toHaveCount(0);
    await seed(61);
    let failOlder = true;
    await page.route('**/api/messages?*', async (route) => {
      if (failOlder && new URL(route.request().url()).searchParams.has('cursor')) {
        await route.fulfill({ status: 503, json: { error: 'Synthetic older-page failure' } });
      } else await route.continue();
    });
    await page.reload();
    await expect(log.getByText('Saved history 060', { exact: true })).toHaveCount(1);
    const input = page.getByRole('textbox', { name: 'Message', exact: true });
    await input.fill('Keep this older-page draft');
    const older = log.getByRole('button', { name: 'Load older messages', exact: true });
    await older.click();
    await expect(log.getByRole('alert')).toHaveText('Could not load older messages. Try again.', {
      timeout: 20_000,
    });
    await expect(log.getByText('Saved history 060', { exact: true })).toHaveCount(1);
    await expect(log.getByRole('button', { name: 'Retry messages', exact: true })).toHaveCount(0);
    await expect(input).toHaveValue('Keep this older-page draft');
    failOlder = false;
    await older.click();
    await expect(log.locator('[data-message-id]')).toHaveCount(61);
    await expect(log.getByRole('alert')).toHaveCount(0);
    await expect(input).toHaveValue('Keep this older-page draft');
  } finally {
    await owned.close();
  }
});

for (const status of [401, 403])
  test(`history ${status} uses access recovery and disables sending`, async ({
    browser,
    baseURL,
  }) => {
    const owned = await fixture(browser, baseURL!, status === 401 ? 235 : 236);
    try {
      const { context, match } = owned;
      const page = await context.newPage();
      // Isolate denial of history from successful session/typing requests.
      await page.route('**/api/messages?*', (route) =>
        route.fulfill({ status, json: { error: 'Synthetic access denial' } }),
      );
      await page.goto(`/messages/${match.id}`);
      await expect(page.getByRole('button', { name: 'Refresh chat', exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeDisabled();
      await expect(page.getByText('No messages yet. Start the conversation!')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Retry messages', exact: true })).toHaveCount(
        0,
      );
      await page.unroute('**/api/messages?*');
      await page.getByRole('button', { name: 'Refresh chat', exact: true }).click();
      await expect(page.getByText('Saved history 000', { exact: true })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
    } finally {
      await owned.close();
    }
  });

test('a failed live history refresh keeps saved messages and the draft until retry', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(60_000);
  const owned = await fixture(browser, baseURL!, 237);
  try {
    const { context, match } = owned;
    const page = await context.newPage();
    await page.goto(`/messages/${match.id}`);
    const log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.getByText('Saved history 000', { exact: true })).toHaveCount(1);
    await expect(
      page.getByText('Live updates unavailable. You can still send messages.'),
    ).toHaveCount(0);
    const input = page.getByRole('textbox', { name: 'Message', exact: true });
    await input.fill('Keep this live refresh draft');
    let fail = true;
    await page.route('**/api/messages?*', async (route) => {
      if (fail) await route.fulfill({ status: 503, json: { error: 'Synthetic refresh failure' } });
      else await route.continue();
    });
    const content = 'Saved while history refresh is unavailable';
    expect(
      (
        await context.request.post('/api/messages', {
          data: { matchId: match.id, content, clientRequestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    await expect(log.getByRole('alert')).toContainText('Could not load messages', {
      timeout: 20_000,
    });
    await expect(log.getByText('Saved history 000', { exact: true })).toHaveCount(1);
    await expect(input).toHaveValue('Keep this live refresh draft');
    fail = false;
    await log.getByRole('button', { name: 'Retry messages', exact: true }).click();
    await expect(log.getByText(content, { exact: true })).toHaveCount(1);
    await expect(log.getByText('Saved history 000', { exact: true })).toHaveCount(1);
    await expect(log.getByRole('alert')).toHaveCount(0);
    await expect(input).toHaveValue('Keep this live refresh draft');
  } finally {
    await owned.close();
  }
});

test('offline pending history waits for reconnection without claiming an empty conversation', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 238);
  let release = () => {};
  try {
    const { context, match } = owned;
    const page = await context.newPage();
    let captured = false;
    let offline = false;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/messages?*', async (route) => {
      captured = true;
      await ready;
      if (offline) await route.abort('internetdisconnected');
      else await route.continue();
    });
    await page.goto(`/messages/${match.id}`);
    await expect.poll(() => captured).toBe(true);
    offline = true;
    await context.setOffline(true);
    release();
    const log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.getByRole('status')).toHaveText('Waiting for a connection to load messages.');
    await expect(log.getByText('No messages yet. Start the conversation!')).toHaveCount(0);
    const input = page.getByRole('textbox', { name: 'Message', exact: true });
    await input.fill('Keep this offline draft');
    offline = false;
    await context.setOffline(false);
    await expect(log.getByText('Saved history 000', { exact: true })).toHaveCount(1);
    await expect(input).toHaveValue('Keep this offline draft');
  } finally {
    release();
    await owned.context.setOffline(false);
    await owned.close();
  }
});
