import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type WebSocketRoute,
} from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';
import { privateHintObserver } from '../helpers/realtime-observer';

async function participants(browser: Browser, baseURL: string, offset: number) {
  if (!assertTestDatabase().native) throw new Error('Native Supabase required.');
  const db = new PrismaClient({ log: [] });
  const contexts: BrowserContext[] = [];
  const observers: Awaited<ReturnType<typeof privateHintObserver>>[] = [];
  const prefix = `bondi-e2e-${randomUUID()}-activity`;
  const close = async () => {
    await Promise.allSettled(observers.map((observer) => observer.close()));
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 3; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Activity owner ${index}`,
          password: 'SyntheticChatActivity79!',
        },
      });
      expect(response.status()).toBe(200);
      const observer = await privateHintObserver(context.request);
      observers.push(observer);
      await db.profile.create({
        data: {
          userId: observer.userId,
          name: `Activity owner ${index}`,
          age: 28,
          bio: 'Synthetic chat activity fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
    }
    const match = await db.match.create({
      data: { user1Id: observers[0].userId, user2Id: observers[1].userId },
    });
    const bindings = observers.map((observer) => ({
      expectedUserId: observer.userId,
      expectedSessionId: observer.sessionId,
    }));
    return { db, contexts, observers, match, bindings, prefix, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('HTTP chat commands bind sessions, bound receipts and deny foreign or ended communication', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixture = await participants(browser, baseURL!, 70);
  try {
    const { db, contexts, observers, match, bindings } = fixture;
    const incoming = await Promise.all(
      [0, 1].map((index) =>
        db.message.create({
          data: {
            matchId: match.id,
            senderId: observers[0].userId,
            content: `Synthetic incoming ${index}`,
          },
        }),
      ),
    );
    const own = await db.message.create({
      data: { matchId: match.id, senderId: observers[1].userId, content: 'Synthetic own message' },
    });
    const foreignMatch = await db.match.create({
      data: { user1Id: observers[1].userId, user2Id: observers[2].userId },
    });
    const foreign = await db.message.create({
      data: {
        matchId: foreignMatch.id,
        senderId: observers[2].userId,
        content: 'Synthetic other conversation',
      },
    });
    const readPath = `/api/matches/${match.id}/read`;
    const typePath = `/api/matches/${match.id}/typing`;
    const snapshot = async (index = 1) => {
      const response = await contexts[index].request.get(
        `${typePath}?${new URLSearchParams(bindings[index])}`,
      );
      expect(response.status()).toBe(200);
      const value = await response.json();
      expect(Object.keys(value).sort()).toEqual(['expiresAt', 'typing']);
      return value;
    };
    const before = observers[0].hints;
    const read = await contexts[1].request.post(readPath, {
      data: { ...bindings[1], ids: [incoming[0].id] },
    });
    expect(read.status()).toBe(200);
    const receipt = await read.json();
    expect(receipt.updated).toBe(1);
    expect(receipt.receipts).toHaveLength(1);
    const firstRead = (await db.message.findUniqueOrThrow({ where: { id: incoming[0].id } }))
      .readAt;
    expect(firstRead).toBeInstanceOf(Date);
    await expect.poll(() => observers[0].hints).toBeGreaterThan(before);
    const replay = await contexts[1].request.post(readPath, {
      data: { ...bindings[1], ids: [incoming[0].id, own.id] },
    });
    expect(replay.status()).toBe(200);
    expect((await replay.json()).updated).toBe(0);
    expect((await db.message.findUniqueOrThrow({ where: { id: incoming[0].id } })).readAt).toEqual(
      firstRead,
    );
    expect((await db.message.findUniqueOrThrow({ where: { id: own.id } })).readAt).toBeNull();
    for (const ids of [[], Array(101).fill(incoming[1].id), [null], [''], ['x'.repeat(129)]])
      expect(
        (await contexts[1].request.post(readPath, { data: { ...bindings[1], ids } })).status(),
      ).toBe(400);
    expect(
      (
        await contexts[1].request.post(readPath, {
          data: { ...bindings[1], ids: [incoming[1].id, foreign.id] },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await db.message.findUniqueOrThrow({ where: { id: incoming[1].id } })).readAt,
    ).toBeNull();
    expect(
      (
        await contexts[2].request.post(readPath, {
          data: { ...bindings[2], ids: [incoming[0].id] },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await request.post(readPath, { data: { ...bindings[1], ids: [incoming[0].id] } })).status(),
    ).toBe(401);
    expect(
      (
        await contexts[1].request.post(readPath, {
          data: { ...bindings[0], ids: [incoming[1].id] },
        })
      ).status(),
    ).toBe(409);

    const typing = {
      ...bindings[0],
      leaseId: observers[0].leaseId,
      viewId: randomUUID(),
      sequence: 1,
      typing: true,
    };
    expect((await contexts[0].request.post(typePath, { data: typing })).status()).toBe(200);
    expect((await snapshot()).typing).toBe(true);
    expect(
      (
        await contexts[0].request.post(typePath, {
          data: { ...typing, sequence: 2, typing: false },
        })
      ).status(),
    ).toBe(200);
    const stale = await contexts[0].request.post(typePath, { data: typing });
    expect(stale.status()).toBe(200);
    expect((await stale.json()).accepted).toBe(false);
    expect((await snapshot()).typing).toBe(false);
    for (const data of [
      { ...typing, sequence: 0 },
      { ...typing, sequence: 1.1 },
      { ...typing, sequence: 2147483648 },
      { ...typing, viewId: 'bad-view' },
      { ...typing, typing: 'true' },
      { ...typing, expiresAt: '2099-01-01' },
      { ...typing, userId: observers[1].userId },
    ])
      expect((await contexts[0].request.post(typePath, { data })).status()).toBe(400);
    expect(
      (
        await contexts[0].request.post(typePath, {
          data: { ...typing, leaseId: observers[1].leaseId },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await contexts[2].request.post(typePath, {
          data: { ...typing, ...bindings[2], leaseId: observers[2].leaseId },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await contexts[2].request.get(`${typePath}?${new URLSearchParams(bindings[2])}`)).status(),
    ).toBe(403);
    expect((await request.get(`${typePath}?${new URLSearchParams(bindings[1])}`)).status()).toBe(
      401,
    );
    expect(
      (await contexts[1].request.get(`${typePath}?${new URLSearchParams(bindings[0])}`)).status(),
    ).toBe(409);

    const payload = {
      matchId: match.id,
      content: 'Session-bound HTTP acceptance',
      clientRequestId: randomUUID(),
    };
    expect(
      (
        await contexts[0].request.post('/api/messages', { data: { ...payload, ...bindings[1] } })
      ).status(),
    ).toBe(409);
    expect(await db.message.count({ where: { clientRequestId: payload.clientRequestId } })).toBe(0);
    const accepted = await contexts[0].request.post('/api/messages', {
      data: { ...payload, ...bindings[0] },
    });
    expect(accepted.status()).toBe(201);
    const again = await contexts[0].request.post('/api/messages', {
      data: { ...payload, ...bindings[0] },
    });
    expect((await again.json()).id).toBe((await accepted.json()).id);
    expect(await db.message.count({ where: { clientRequestId: payload.clientRequestId } })).toBe(1);
    expect((await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(
      200,
    );
    expect(
      (await contexts[0].request.post(typePath, { data: { ...typing, sequence: 3 } })).status(),
    ).toBe(403);
    expect(
      (
        await contexts[1].request.post(readPath, {
          data: { ...bindings[1], ids: [incoming[1].id] },
        })
      ).status(),
    ).toBe(403);
    expect(
      (await contexts[1].request.get(`${typePath}?${new URLSearchParams(bindings[1])}`)).status(),
    ).toBe(403);
    const history = await contexts[1].request.get(`/api/messages?matchId=${match.id}`);
    expect(history.status()).toBe(200);
    expect(
      (await history.json()).items.some((message: { id: string }) => message.id === incoming[0].id),
    ).toBe(true);
    expect(observers[2].hints).toBe(0);
  } finally {
    await fixture.close();
  }
});

test('typing expires, combines views and retains ordering only while its authoritative capability is live', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 74);
  try {
    const { db, contexts, observers, match, bindings } = fixture;
    const path = `/api/matches/${match.id}/typing`;
    const read = async () => {
      const response = await contexts[1].request.get(`${path}?${new URLSearchParams(bindings[1])}`);
      expect(response.status()).toBe(200);
      return response.json();
    };
    const first = {
      ...bindings[0],
      leaseId: observers[0].leaseId,
      viewId: randomUUID(),
      sequence: 1,
      typing: true,
    };
    const second = { ...first, viewId: randomUUID() };
    for (const data of [first, second, { ...first, sequence: 2, typing: false }])
      expect((await contexts[0].request.post(path, { data })).status()).toBe(200);
    expect((await read()).typing).toBe(true);
    const state = await read();
    expect(Date.parse(state.expiresAt) - Date.now()).toBeLessThanOrEqual(5000);
    await expect.poll(async () => (await read()).typing, { timeout: 7000 }).toBe(false);
    await db.$executeRaw`SELECT bondi_private.prune_typing_leases()`;
    expect(await db.typingLease.count({ where: { leaseId: first.leaseId } })).toBe(2);
    const stale = await contexts[0].request.post(path, { data: first });
    expect((await stale.json()).accepted).toBe(false);
    expect((await read()).typing).toBe(false);
    expect(
      (await contexts[0].request.post(path, { data: { ...second, sequence: 2 } })).status(),
    ).toBe(200);
    expect((await read()).typing).toBe(true);
    await db.session.update({
      where: { id: observers[0].sessionId },
      data: { expiresAt: new Date(0) },
    });
    expect((await read()).typing).toBe(false);
    expect(
      (await contexts[0].request.post(path, { data: { ...second, sequence: 3 } })).status(),
    ).toBe(401);
    await db.$executeRaw`SELECT bondi_private.prune_typing_leases()`;
    expect(await db.typingLease.count({ where: { leaseId: first.leaseId } })).toBe(0);
    expect(
      (
        await contexts[0].request.post(`/api/matches/${match.id}/read`, {
          data: { ...bindings[0], ids: ['synthetic-message'] },
        })
      ).status(),
    ).toBe(401);
    const privilege = await db.$queryRaw<
      Array<{ allowed: boolean }>
    >`SELECT has_function_privilege('authenticated', 'bondi_private.prune_typing_leases()', 'EXECUTE') AS allowed`;
    expect(privilege).toEqual([{ allowed: false }]);
  } finally {
    await fixture.close();
  }
});

test('native browsers type and read through HTTP, and can send with live updates disconnected', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 78);
  const connections: Array<{ client: WebSocketRoute; upstream: WebSocketRoute }> = [];
  let blocked = false;
  try {
    const { contexts, db, match, observers } = fixture;
    const alice = await contexts[0].newPage();
    const bob = await contexts[1].newPage();
    const frames: string[] = [];
    const http: string[] = [];
    const routeSocket = (client: WebSocketRoute) => {
      if (blocked) {
        void client.close();
        return;
      }
      const upstream = client.connectToServer();
      connections.push({ client, upstream });
      client.onMessage((data) => {
        frames.push(data.toString());
        upstream.send(data);
      });
    };
    await alice.routeWebSocket('**/realtime/v1/websocket**', routeSocket);
    for (const page of [alice, bob]) {
      page.on('request', (request) => {
        if (request.method() === 'POST') http.push(new URL(request.url()).pathname);
      });
      await page.goto(`/messages/${match.id}`);
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
      await expect(
        page.getByRole('button', { name: 'Retry live updates', exact: true }),
      ).toHaveCount(0);
    }
    await expect.poll(() => frames.some((frame) => frame.includes('phx_join'))).toBe(true);
    await alice
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('A synthetic typing signal');
    await expect(bob.getByRole('status', { name: 'Typing indicator' })).toBeVisible();
    await alice.getByRole('textbox', { name: 'Message', exact: true }).fill('');
    await expect(bob.getByRole('status', { name: 'Typing indicator' })).toHaveCount(0);
    const content = 'A native browser HTTP message and receipt';
    await alice.getByRole('textbox', { name: 'Message', exact: true }).fill(content);
    await alice.getByRole('button', { name: 'Send message', exact: true }).click();
    for (const page of [alice, bob])
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(content, { exact: true }),
      ).toHaveCount(1);
    await expect(alice.getByRole('img', { name: 'Read', exact: true })).toHaveCount(1);
    const stored = await db.message.findFirstOrThrow({ where: { matchId: match.id, content } });
    expect(stored.readAt).toBeInstanceOf(Date);
    blocked = true;
    const initiallyClosed = connections.length;
    await Promise.all(
      connections.flatMap(({ client, upstream }) => [client.close(), upstream.close()]),
    );
    await expect(
      alice.getByText('Live updates unavailable. You can still send messages.'),
    ).toBeVisible();
    await expect(alice.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
    const offline = 'HTTP remains durable while live updates are unavailable';
    await alice.getByRole('textbox', { name: 'Message', exact: true }).fill(offline);
    await alice.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(alice.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
    for (const page of [alice, bob])
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(offline, { exact: true }),
      ).toHaveCount(1);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(2);
    blocked = false;
    await alice.getByRole('button', { name: 'Retry live updates', exact: true }).click();
    await expect(
      alice.getByRole('button', { name: 'Retry live updates', exact: true }),
    ).toHaveCount(0);
    const recovered = 'Native updates resume after the explicit retry';
    await bob.getByRole('textbox', { name: 'Message', exact: true }).fill(recovered);
    await bob.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(
      alice
        .getByRole('log', { name: 'Conversation messages' })
        .getByText(recovered, { exact: true }),
    ).toHaveCount(1);
    await expect(bob.getByRole('img', { name: 'Read', exact: true })).toHaveCount(1);
    blocked = true;
    await Promise.all(
      connections
        .slice(initiallyClosed)
        .flatMap(({ client, upstream }) => [client.close(), upstream.close()]),
    );
    await expect(
      alice.getByRole('button', { name: 'Retry live updates', exact: true }),
    ).toBeVisible();
    for (const endpoint of [
      '/api/messages',
      `/api/matches/${match.id}/read`,
      `/api/matches/${match.id}/typing`,
    ])
      expect(http).toContain(endpoint);
    for (const command of [
      'message:send',
      'message:read',
      'match:join',
      'match:leave',
      'typing:start',
      'typing:stop',
    ])
      expect(
        frames.some((frame) => frame.includes(`"${command}"`)),
        command,
      ).toBe(false);
    const currentSession = alice.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/auth/get-session' && response.status() === 200,
    );
    await alice.clock.setFixedTime(await alice.evaluate(() => Date.now() + 6000));
    await alice.bringToFront();
    await alice.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    expect((await (await currentSession).json()).user.id).toBe(observers[0].userId);
    await db.session.update({
      where: { id: observers[0].sessionId },
      data: { expiresAt: new Date(0) },
    });
    const denied = alice.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/messages' &&
        response.request().method() === 'POST' &&
        response.status() === 401,
    );
    await alice
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Reject the next protected request after revocation');
    await alice.getByRole('button', { name: 'Send message', exact: true }).click();
    await denied;
    await expect
      .poll(
        async () =>
          new URL(alice.url()).pathname === '/login' ||
          (await alice.getByRole('textbox', { name: 'Message', exact: true }).count()) === 0 ||
          (await alice.getByRole('textbox', { name: 'Message', exact: true }).isDisabled()),
      )
      .toBe(true);
    if (new URL(alice.url()).pathname !== '/login')
      await expect(alice.getByRole('button', { name: 'Refresh chat', exact: true })).toBeVisible();
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(3);
  } finally {
    await fixture.close();
  }
});

test('late accepted HTTP responses cannot clear another conversation or a newer draft after timeout', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 82);
  const releases: Array<() => void> = [];
  try {
    const { contexts, db, match, observers } = fixture;
    const other = await db.match.create({
      data: { user1Id: observers[0].userId, user2Id: observers[2].userId },
    });
    const page = await contexts[0].newPage();
    let held = 0;
    await page.route('**/api/messages', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await new Promise<void>((resolve) => {
        releases.push(resolve);
        held++;
      });
      await route.fulfill({ response });
    });
    await page.goto(`/messages/${match.id}`);
    const initial = 'Accepted before changing the selected conversation';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(initial);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect.poll(() => held).toBe(1);
    await page.locator(`a[href="/messages/${other.id}"]`).first().click();
    const next = 'A different conversation owns this new draft';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(next);
    releases[0]();
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(next);
    expect(await db.message.count({ where: { matchId: match.id, content: initial } })).toBe(1);
    await page.clock.install();
    const timedOut = 'Accepted before its HTTP response times out';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(timedOut);
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect.poll(() => held).toBe(2);
    await page.clock.fastForward(8100);
    await expect(page.getByRole('alert', { name: 'Message send error' })).toContainText(
      'not confirmed',
    );
    const newer = 'Keep the newer draft when that old response is released';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(newer);
    releases[1]();
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(newer);
    expect(await db.message.count({ where: { matchId: other.id, content: timedOut } })).toBe(1);
    expect(await db.message.count({ where: { content: newer } })).toBe(0);
  } finally {
    for (const release of releases) release();
    await fixture.close();
  }
});

test('an old-account accepted response cannot clear the next signed-in account draft', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 86);
  let release = () => {};
  try {
    const page = await fixture.contexts[0].newPage();
    await page.addInitScript(() => {
      const state = {
        marker: crypto.randomUUID(),
        held: false,
        released: false,
        release: () => {},
      };
      (window as typeof window & { chatResponseProbe: typeof state }).chatResponseProbe = state;
      const nativeFetch = window.fetch.bind(window);
      let first = true;
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' || input instanceof URL ? input : input.url;
        const response = await nativeFetch(input, init);
        if (
          first &&
          new URL(url, location.href).pathname === '/api/messages' &&
          init?.method === 'POST'
        ) {
          first = false;
          const accepted = await response.clone().json();
          response.json = async () => accepted;
          state.held = true;
          await new Promise<void>((resolve) => {
            state.release = resolve;
          });
          state.released = true;
        }
        return response;
      };
    });
    const probe = () =>
      page.evaluate(() => {
        const state = (
          window as typeof window & {
            chatResponseProbe: { marker: string; held: boolean; released: boolean };
          }
        ).chatResponseProbe;
        return { marker: state.marker, held: state.held, released: state.released };
      });
    const releaseResponse = () =>
      page.evaluate(() =>
        (
          window as typeof window & { chatResponseProbe: { release: () => void } }
        ).chatResponseProbe.release(),
      );
    release = () => {
      void releaseResponse().catch(() => {});
    };
    await page.goto(`/messages/${fixture.match.id}`);
    const first = await probe();
    await page
      .getByRole('textbox', { name: 'Message', exact: true })
      .fill('Old account accepted operation');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect.poll(async () => (await probe()).held).toBe(true);
    await page.getByRole('button', { name: /Activity owner 0/ }).click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email', { exact: true }).fill(`${fixture.prefix}-1@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('SyntheticChatActivity79!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await page.locator('a[href="/messages"]:visible').first().click();
    await page.locator(`a[href="/messages/${fixture.match.id}"]`).first().click();
    const next = 'The next account owns this draft';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(next);
    expect((await probe()).marker).toBe(first.marker);
    await releaseResponse();
    await expect.poll(async () => (await probe()).released).toBe(true);
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(next);
    expect(await fixture.db.message.count({ where: { matchId: fixture.match.id } })).toBe(1);
  } finally {
    release();
    await fixture.close();
  }
});

test('typing retention skips an authoritative capability that is being renewed', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 90);
  const other = new PrismaClient({ log: [] });
  let release = () => {};
  let renewal: Promise<unknown> | undefined;
  let paused = false;
  try {
    const { db, contexts, observers, bindings, match } = fixture;
    await db.$queryRaw`SELECT cron.unschedule('bondi-typing-retention')`;
    paused = true;
    const input = {
      ...bindings[0],
      leaseId: observers[0].leaseId,
      viewId: randomUUID(),
      sequence: 2,
      typing: false,
    };
    expect(
      (await contexts[0].request.post(`/api/matches/${match.id}/typing`, { data: input })).status(),
    ).toBe(200);
    await db.realtimeLease.update({
      where: { id: input.leaseId },
      data: { expiresAt: new Date(0) },
    });
    let started = () => {};
    const held = new Promise<void>((resolve) => {
      started = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    renewal = other.$transaction(async (tx) => {
      await tx.realtimeLease.update({
        where: { id: input.leaseId },
        data: { expiresAt: new Date(Date.now() + 90_000) },
      });
      started();
      await barrier;
    });
    await held;
    await db.$executeRaw`SELECT bondi_private.prune_typing_leases()`;
    expect(await db.typingLease.count({ where: { leaseId: input.leaseId } })).toBe(1);
    release();
    await renewal;
    const delayed = await contexts[0].request.post(`/api/matches/${match.id}/typing`, {
      data: { ...input, sequence: 1, typing: true },
    });
    expect(delayed.status()).toBe(200);
    expect((await delayed.json()).accepted).toBe(false);
  } finally {
    release();
    await renewal?.catch(() => {});
    if (paused)
      await fixture.db
        .$queryRaw`SELECT cron.schedule('bondi-typing-retention', '* * * * *', 'SELECT bondi_private.prune_typing_leases()')`;
    await fixture.close();
    await other.$disconnect();
  }
});
