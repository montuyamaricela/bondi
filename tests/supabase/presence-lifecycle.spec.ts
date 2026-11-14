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
import { writePresence } from '../../lib/server/native-presence';
import { publishRealtimeHint } from '../../lib/server/realtime';

async function participants(browser: Browser, baseURL: string, offset: number) {
  if (!assertTestDatabase().native) throw new Error('Native Supabase required.');
  const db = new PrismaClient({ log: [] });
  const contexts: BrowserContext[] = [];
  const observers: Awaited<ReturnType<typeof privateHintObserver>>[] = [];
  const prefix = `bondi-e2e-${randomUUID()}-presence80`;
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
          name: `Presence ${index}`,
          password: 'SyntheticPresence80!',
        },
      });
      expect(response.status()).toBe(200);
      const observer = await privateHintObserver(context.request);
      observers.push(observer);
      await db.profile.create({
        data: {
          userId: observer.userId,
          name: `Presence ${index}`,
          age: 28,
          bio: 'Synthetic native presence fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: true,
        },
      });
    }
    const match = await db.match.create({
      data: { user1Id: observers[0].userId, user2Id: observers[1].userId },
    });
    const bindings = observers.map(({ userId, sessionId }) => ({
      expectedUserId: userId,
      expectedSessionId: sessionId,
    }));
    return { db, contexts, observers, match, bindings, prefix, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('native presence validates ownership, orders liveness and counts only visible active peers with live sessions', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixture = await participants(browser, baseURL!, 94);
  const { db, contexts, observers, bindings, match } = fixture;
  const target = observers[1];
  const input = { ...bindings[1], leaseId: target.leaseId };
  const invisible = { visible: false, online: false };
  const snapshot = async (index = 0) => {
    const response = await contexts[index].request.post('/api/users/presence', {
      data: { ...bindings[index], userIds: [target.userId] },
    });
    expect(response.status()).toBe(200);
    return response.json();
  };
  try {
    expect(
      (await request.post('/api/presence', { data: { ...input, sequence: 1 } })).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/users/presence', { data: { ...bindings[0], userIds: [] } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await contexts[1].request.post('/api/presence', {
          data: { ...input, expectedUserId: observers[0].userId, sequence: 1 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await contexts[1].request.post('/api/presence', {
          data: { ...input, leaseId: observers[0].leaseId, sequence: 1 },
        })
      ).status(),
    ).toBe(409);
    for (const extra of [
      { sequence: 0 },
      { sequence: 1.5 },
      { sequence: 2_147_483_648 },
      { sequence: 1, userId: target.userId },
      { sequence: 1, expiresAt: new Date().toISOString() },
      { sequence: 1, visible: true },
    ]) {
      expect(
        (
          await contexts[1].request.post('/api/presence', { data: { ...input, ...extra } })
        ).status(),
      ).toBe(400);
    }
    expect(
      (
        await contexts[0].request.post('/api/users/presence', {
          data: { ...bindings[0], userIds: Array.from({ length: 101 }, () => target.userId) },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await contexts[0].request.post('/api/users/presence', {
          data: { ...bindings[1], userIds: [target.userId] },
        })
      ).status(),
    ).toBe(409);
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: false } });
    const start = Date.now();
    expect(
      (
        await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 1 } })
      ).status(),
    ).toBe(200);
    const lease = await db.realtimeLease.findUniqueOrThrow({ where: { id: target.leaseId } });
    expect(lease.presenceExpiresAt!.getTime()).toBeGreaterThanOrEqual(start + 59_000);
    expect(lease.presenceExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now() + 60_001);
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: true } });
    expect(await snapshot(2)).toEqual({ [target.userId]: invisible });
    await expect.poll(() => observers[0].hints).toBeGreaterThan(0);
    expect(observers[2].hints).toBe(0);
    const secondTab = await privateHintObserver(contexts[1].request);
    try {
      expect(
        (
          await contexts[1].request.post('/api/presence', {
            data: { ...bindings[1], leaseId: secondTab.leaseId, sequence: 1 },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await contexts[1].request.delete('/api/presence', { data: { ...input, sequence: 3 } })
        ).status(),
      ).toBe(200);
      expect(
        await (
          await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 2 } })
        ).json(),
      ).toEqual({ accepted: false });
      expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: true } });
    } finally {
      await secondTab.close();
    }
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: false } });
    await db.session.update({
      where: { id: target.sessionId },
      data: { expiresAt: new Date(Date.now() + 30_000) },
    });
    await db.realtimeLease.update({
      where: { id: target.leaseId },
      data: { expiresAt: new Date(Date.now() + 45_000) },
    });
    expect(
      (
        await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 4 } })
      ).status(),
    ).toBe(200);
    const capped = await db.realtimeLease.findUniqueOrThrow({
      where: { id: target.leaseId },
      include: { session: true },
    });
    expect(capped.presenceExpiresAt).toEqual(capped.expiresAt);
    // Better Auth renews a short valid session during HTTP resolution. Check the
    // server operation's session cap before that separate renewal can run.
    await db.session.update({
      where: { id: target.sessionId },
      data: { expiresAt: new Date(Date.now() + 30_000) },
    });
    expect(
      await writePresence(
        { userId: target.userId, sessionId: target.sessionId },
        { ...input, sequence: 5 },
        true,
      ),
    ).toEqual({ accepted: true });
    const sessionCapped = await db.realtimeLease.findUniqueOrThrow({
      where: { id: target.leaseId },
      include: { session: true },
    });
    expect(sessionCapped.presenceExpiresAt).toEqual(sessionCapped.session.expiresAt);
    const beforeHidden = observers[0].hints;
    expect(
      (
        await contexts[1].request.patch('/api/profile/privacy', {
          data: { ...bindings[1], showOnlineStatus: false },
        })
      ).status(),
    ).toBe(200);
    await expect.poll(() => observers[0].hints).toBeGreaterThan(beforeHidden);
    expect(await snapshot()).toEqual({ [target.userId]: invisible });
    expect(
      (
        await contexts[1].request.patch('/api/profile/privacy', {
          data: { ...bindings[0], showOnlineStatus: true },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await contexts[1].request.patch('/api/profile/privacy', {
          data: { ...bindings[1], showOnlineStatus: true },
        })
      ).status(),
    ).toBe(200);
    await db.realtimeLease.update({
      where: { id: target.leaseId },
      data: { presenceExpiresAt: new Date(Date.now() - 1000) },
    });
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: false } });
    expect(
      (
        await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 6 } })
      ).status(),
    ).toBe(200);
    await db.session.update({
      where: { id: target.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: false } });
    expect(
      (
        await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 7 } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await contexts[1].request.post('/api/users/presence', {
          data: { ...bindings[1], userIds: [observers[0].userId] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await contexts[1].request.post('/api/auth/sign-in/email', {
          headers: { Origin: baseURL! },
          data: { email: `${fixture.prefix}-1@example.test`, password: 'SyntheticPresence80!' },
        })
      ).status(),
    ).toBe(200);
    const renewed = await privateHintObserver(contexts[1].request);
    observers.push(renewed);
    expect(renewed.sessionId).not.toBe(target.sessionId);
    expect(
      (
        await contexts[1].request.post('/api/presence', { data: { ...input, sequence: 8 } })
      ).status(),
    ).toBe(409);
    expect(
      (
        await contexts[1].request.post('/api/presence', {
          data: {
            expectedUserId: renewed.userId,
            expectedSessionId: renewed.sessionId,
            leaseId: renewed.leaseId,
            sequence: 1,
          },
        })
      ).status(),
    ).toBe(200);
    const beforeLogout = observers[0].hints;
    expect(
      (
        await contexts[1].request.post('/api/auth/sign-out', {
          headers: { Origin: baseURL! },
          data: {},
        })
      ).status(),
    ).toBe(200);
    await expect.poll(() => observers[0].hints).toBeGreaterThan(beforeLogout);
    expect(await snapshot()).toEqual({ [target.userId]: { visible: true, online: false } });
    expect(
      (
        await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`, { data: bindings[2] })
      ).status(),
    ).toBe(409);
    expect(
      (
        await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`, {
          headers: { 'Content-Type': 'application/json' },
          data: Buffer.from('{'),
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`, { data: bindings[0] })
      ).status(),
    ).toBe(200);
    expect(await snapshot()).toEqual({ [target.userId]: invisible });
    expect((await contexts[0].request.get(`/api/messages?matchId=${match.id}`)).status()).toBe(200);
    expect(
      (
        await contexts[0].request.post('/api/messages', {
          data: {
            ...bindings[0],
            matchId: match.id,
            content: 'Denied after unmatch',
            clientRequestId: randomUUID(),
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await contexts[0].request.post(`/api/matches/${match.id}/typing`, {
          data: {
            ...bindings[0],
            leaseId: observers[0].leaseId,
            viewId: randomUUID(),
            sequence: 1,
            typing: true,
          },
        })
      ).status(),
    ).toBe(403);
    expect(observers[2].hints).toBe(0);
  } finally {
    await fixture.close();
  }
});

test('real native tabs aggregate liveness and retract held privacy snapshots and both unmatched chats', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 98);
  const { contexts, observers, match } = fixture;
  let release: (() => void) | undefined;
  try {
    for (const context of contexts.slice(0, 2)) {
      await context.routeWebSocket('**/socket.io/**', (socket) => {
        void socket.close();
      });
      await context.route('**/socket.io/**', (route) => route.abort());
    }
    const target = await contexts[1].newPage();
    await target.goto('/settings');
    const viewer = await contexts[0].newPage();
    await viewer.goto(`/messages/${match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    const secondTab = await contexts[1].newPage();
    await secondTab.goto('/settings');
    await expect
      .poll(() =>
        fixture.db.realtimeLease.count({
          where: { userId: observers[1].userId, presenceExpiresAt: { gt: new Date() } },
        }),
      )
      .toBe(2);
    await target.close();
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    let held = false;
    let settled = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await viewer.route('**/api/users/presence', async (route) => {
      if (held) return route.continue();
      held = true;
      const response = await route.fetch();
      expect(await response.json()).toEqual({
        [observers[1].userId]: { visible: true, online: true },
      });
      await gate;
      try {
        await route.fulfill({ response });
      } finally {
        settled = true;
      }
    });
    await viewer.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => held).toBe(true);
    const control = secondTab.getByRole('checkbox', { name: 'Show Online Status', exact: true });
    const hiddenRead = viewer.waitForResponse(async (response) => {
      if (new URL(response.url()).pathname !== '/api/users/presence' || !response.ok())
        return false;
      try {
        return (await response.json())[observers[1].userId]?.visible === false;
      } catch {
        return false;
      }
    });
    const hideSaved = secondTab.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/profile/privacy' && response.status() === 200,
    );
    await control.focus();
    await control.press('Space');
    await hideSaved;
    await hiddenRead;
    await expect(control).not.toBeChecked();
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    await expect(viewer.getByText('Offline', { exact: true })).toHaveCount(0);
    release!();
    await expect.poll(() => settled).toBe(true);
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    const showSaved = secondTab.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/profile/privacy' && response.status() === 200,
    );
    await control.focus();
    await control.press('Space');
    await showSaved;
    await expect(control).toBeChecked();
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await secondTab.close();
    await expect(viewer.getByText('Offline', { exact: true })).toBeVisible();
    const peerChat = await contexts[1].newPage();
    await peerChat.goto(`/messages/${match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await viewer.getByRole('button', { name: 'More options', exact: true }).click();
    await viewer.getByRole('menuitem', { name: 'Unmatch', exact: true }).click();
    await viewer.getByRole('dialog').getByRole('button', { name: 'Unmatch', exact: true }).click();
    for (const page of [viewer, peerChat]) {
      await expect(
        page.getByText('This match has ended. You can still read the conversation.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText('Active now', { exact: true })).toHaveCount(0);
      await expect(page.getByTitle('Online', { exact: true })).toHaveCount(0);
      await expect(page.getByPlaceholder('Type a message...')).toHaveCount(0);
    }
  } finally {
    release?.();
    await fixture.close();
  }
});

test('native liveness and peer snapshot failures degrade visibly and recover explicitly', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 102);
  try {
    const target = await fixture.contexts[1].newPage();
    let failHeartbeat = true;
    await target.route('**/api/presence', async (route) => {
      if (failHeartbeat && route.request().method() === 'POST')
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Synthetic liveness failure"}',
        });
      return route.continue();
    });
    await target.goto('/settings');
    await expect(
      target.getByRole('alert').filter({ hasText: 'Online status is unavailable.' }),
    ).toBeVisible();
    failHeartbeat = false;
    await target.getByRole('button', { name: 'Retry online status', exact: true }).click();
    await expect(
      target.getByRole('alert').filter({ hasText: 'Online status is unavailable.' }),
    ).toHaveCount(0);
    const viewer = await fixture.contexts[0].newPage();
    let failSnapshot = true;
    await viewer.route('**/api/users/presence', async (route) => {
      if (failSnapshot)
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Synthetic snapshot failure"}',
        });
      return route.continue();
    });
    await viewer.goto(`/messages/${fixture.match.id}`);
    await expect(
      viewer.getByText('Online status unavailable', { exact: false }).first(),
    ).toBeVisible();
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    await viewer.bringToFront();
    const focusedFailure = viewer.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/users/presence' && response.status() === 503,
    );
    await viewer.evaluate(() => window.dispatchEvent(new Event('focus')));
    await focusedFailure;
    await expect(viewer.getByRole('button', { name: 'Retry status', exact: true })).toBeVisible();
    failSnapshot = false;
    await viewer.getByRole('button', { name: 'Retry status', exact: true }).click();
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await target.close();
    await expect(viewer.getByText('Offline', { exact: true })).toBeVisible();
  } finally {
    await fixture.close();
  }
});

test('abrupt native connection loss expires server liveness and the observer polling window repairs status', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 106);
  const connections: Array<{ client: WebSocketRoute; upstream: WebSocketRoute }> = [];
  let blocked = false;
  try {
    const target = await fixture.contexts[1].newPage();
    let joins = 0;
    let legacyConnections = 0;
    target.on('websocket', (socket) => {
      if (!new URL(socket.url()).pathname.startsWith('/socket.io/')) return;
      legacyConnections++;
      socket.on('close', () => {
        legacyConnections--;
      });
    });
    await target.routeWebSocket('**/realtime/v1/websocket**', (client) => {
      if (blocked) {
        void client.close();
        return;
      }
      const upstream = client.connectToServer();
      connections.push({ client, upstream });
      client.onMessage((data) => {
        if (data.toString().includes('phx_join')) joins++;
        upstream.send(data);
      });
    });
    for (const endpoint of ['**/api/presence', '**/api/realtime/credential'])
      await target.route(endpoint, (route) => (blocked ? route.abort() : route.continue()));
    await target.goto(`/messages/${fixture.match.id}`);
    const viewer = await fixture.contexts[0].newPage();
    await viewer.clock.install();
    await viewer.goto(`/messages/${fixture.match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    await expect.poll(() => joins).toBeGreaterThan(0);
    await expect.poll(() => legacyConnections).toBeGreaterThan(0);
    blocked = true;
    await Promise.all(
      connections.flatMap(({ client, upstream }) => [client.close(), upstream.close()]),
    );
    await expect(
      target.getByRole('button', { name: 'Retry live updates', exact: true }),
    ).toBeVisible();
    // The normal 60s deadline is asserted above. Shorten only this synthetic row
    // to exercise expiry deterministically without a minute-long wall-clock wait.
    await fixture.db.realtimeLease.updateMany({
      where: { userId: fixture.observers[1].userId, presenceExpiresAt: { not: null } },
      data: { presenceExpiresAt: new Date(Date.now() + 500) },
    });
    await expect
      .poll(async () => {
        const response = await fixture.contexts[0].request.post('/api/users/presence', {
          data: { ...fixture.bindings[0], userIds: [fixture.observers[1].userId] },
        });
        expect(response.status()).toBe(200);
        return (await response.json())[fixture.observers[1].userId].online;
      })
      .toBe(false);
    expect(legacyConnections).toBeGreaterThan(0);
    await viewer.clock.runFor(15_001);
    await expect(viewer.getByText('Offline', { exact: true })).toBeVisible();
    await expect(viewer.getByTitle('Online', { exact: true })).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});

test('a buffered old-account heartbeat cannot update the next owner or restart its old timer', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 110);
  let release = () => {};
  type Probe = {
    marker: string;
    held: boolean;
    released: boolean;
    oldOwner: string;
    oldCalls: number;
    nextCalls: number;
    nextResponses: number;
    release: () => void;
  };
  try {
    const page = await fixture.contexts[0].newPage();
    await page.clock.install();
    await page.addInitScript(() => {
      const state: Probe = {
        marker: crypto.randomUUID(),
        held: false,
        released: false,
        oldOwner: '',
        oldCalls: 0,
        nextCalls: 0,
        nextResponses: 0,
        release: () => {},
      };
      (window as typeof window & { presenceResponseProbe: Probe }).presenceResponseProbe = state;
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' || input instanceof URL ? input : input.url;
        const heartbeat =
          new URL(url, location.href).pathname === '/api/presence' && init?.method === 'POST';
        const first = heartbeat && !state.oldOwner;
        if (heartbeat) {
          const owner = JSON.parse(String(init?.body)).expectedUserId;
          if (first) state.oldOwner = owner;
          if (owner === state.oldOwner) state.oldCalls++;
          else state.nextCalls++;
        }
        const response = await nativeFetch(input, init);
        if (heartbeat && !first) {
          const accepted = await response.clone().json();
          if (response.ok && accepted.accepted) state.nextResponses++;
        }
        if (first) {
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
        const { marker, held, released, oldCalls, nextCalls, nextResponses } = (
          window as typeof window & { presenceResponseProbe: Probe }
        ).presenceResponseProbe;
        return { marker, held, released, oldCalls, nextCalls, nextResponses };
      });
    const releaseResponse = () =>
      page.evaluate(() =>
        (
          window as typeof window & { presenceResponseProbe: Probe }
        ).presenceResponseProbe.release(),
      );
    release = () => {
      void releaseResponse().catch(() => {});
    };
    await page.goto('/settings');
    await expect.poll(async () => (await probe()).held).toBe(true);
    const first = await probe();
    await page.getByRole('button', { name: /Presence 0/ }).click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email', { exact: true }).fill(`${fixture.prefix}-1@example.test`);
    await page.getByLabel('Password', { exact: true }).fill('SyntheticPresence80!');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/discover$/);
    await expect.poll(async () => (await probe()).nextCalls).toBeGreaterThan(0);
    await expect.poll(async () => (await probe()).nextResponses).toBeGreaterThan(0);
    expect((await probe()).marker).toBe(first.marker);
    await releaseResponse();
    await expect.poll(async () => (await probe()).released).toBe(true);
    const next = (await probe()).nextCalls;
    await page.clock.runFor(20_001);
    await expect.poll(async () => (await probe()).nextCalls).toBeGreaterThan(next);
    expect((await probe()).oldCalls).toBe(1);
    expect(
      await fixture.db.realtimeLease.count({ where: { userId: fixture.observers[0].userId } }),
    ).toBe(0);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Online status is unavailable.' }),
    ).toHaveCount(0);
  } finally {
    release();
    await fixture.close();
  }
});

test('repeated native hints cannot keep an unrefreshed presence snapshot online indefinitely', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 114);
  let release = () => {};
  try {
    const target = await fixture.contexts[1].newPage();
    await target.goto('/settings');
    const viewer = await fixture.contexts[0].newPage();
    await viewer.clock.install();
    await viewer.goto(`/messages/${fixture.match.id}`);
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held = 0;
    await viewer.route('**/api/users/presence', async (route) => {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      held++;
      await gate;
      await route.fulfill({ response });
    });
    await publishRealtimeHint(fixture.observers[0].userId);
    await expect.poll(() => held).toBeGreaterThan(0);
    for (let index = 1; index <= 5; index++) {
      await viewer.clock.runFor(4000);
      await publishRealtimeHint(fixture.observers[0].userId);
      await expect.poll(() => held).toBeGreaterThan(index);
    }
    await expect(viewer.getByText('Online status unavailable', { exact: true })).toBeVisible();
    await expect(viewer.getByText('Active now', { exact: true })).toHaveCount(0);
    release();
    await expect(viewer.getByText('Active now', { exact: true })).toBeVisible();
  } finally {
    release();
    await fixture.close();
  }
});

test('a signed cleanup capability closes only its issued lease after the cookie owner changes', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixture = await participants(browser, baseURL!, 118);
  try {
    const issue = async () => {
      const response = await fixture.contexts[0].request.post('/api/realtime/credential', {
        data: fixture.bindings[0],
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    const first = await issue();
    const other = await issue();
    const input = { ...fixture.bindings[0], leaseId: first.leaseId, closeToken: first.closeToken };
    expect(first.closeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (await request.post('/api/presence', { data: { ...input, sequence: 1 } })).status(),
    ).toBe(401);
    expect(
      (
        await request.post('/api/users/presence', {
          data: { ...input, userIds: [fixture.observers[1].userId] },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await fixture.contexts[0].request.post('/api/realtime/credential', { data: input })
      ).status(),
    ).toBe(400);
    for (const invalid of [
      { closeToken: '0'.repeat(64) },
      { leaseId: other.leaseId },
      { expectedUserId: fixture.observers[1].userId },
      { expectedSessionId: fixture.observers[1].sessionId },
    ]) {
      expect(
        (
          await fixture.contexts[1].request.delete('/api/realtime/credential', {
            data: { ...input, ...invalid },
          })
        ).status(),
      ).toBe(403);
      expect(
        await fixture.db.realtimeLease.findUnique({ where: { id: first.leaseId } }),
      ).not.toBeNull();
    }
    expect(
      (
        await request.delete('/api/realtime/credential', {
          data: { ...input, closeToken: '0'.repeat(64) },
        })
      ).status(),
    ).toBe(401);
    const before = fixture.observers[1].hints;
    expect(
      (
        await fixture.contexts[1].request.delete('/api/realtime/credential', { data: input })
      ).status(),
    ).toBe(200);
    expect(await fixture.db.realtimeLease.findUnique({ where: { id: first.leaseId } })).toBeNull();
    await expect.poll(() => fixture.observers[1].hints).toBeGreaterThan(before);
    expect((await request.delete('/api/realtime/credential', { data: input })).status()).toBe(200);
    expect(
      (
        await request.delete('/api/realtime/credential', {
          data: { ...input, leaseId: other.leaseId },
        })
      ).status(),
    ).toBe(401);
    expect(
      await fixture.db.realtimeLease.findUnique({ where: { id: other.leaseId } }),
    ).not.toBeNull();
    expect(
      await fixture.db.realtimeLease.findUnique({ where: { id: fixture.observers[0].leaseId } }),
    ).not.toBeNull();
  } finally {
    await fixture.close();
  }
});

test('a rejected renewal closes the retired liveness before the new account snapshot can complete', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 122);
  let release = () => {};
  try {
    const page = await fixture.contexts[0].newPage();
    await page.goto('/settings');
    await expect
      .poll(() =>
        fixture.db.realtimeLease.count({
          where: { userId: fixture.observers[0].userId, presenceExpiresAt: { gt: new Date() } },
        }),
      )
      .toBe(1);
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let heldSession = false;
    await page.route('**/api/auth/get-session', async (route) => {
      const response = await route.fetch();
      heldSession = true;
      await gate;
      await route.fulfill({ response });
    });
    await fixture.contexts[0].clearCookies();
    expect(
      (
        await fixture.contexts[0].request.post('/api/auth/sign-in/email', {
          headers: { Origin: baseURL! },
          data: { email: `${fixture.prefix}-1@example.test`, password: 'SyntheticPresence80!' },
        })
      ).status(),
    ).toBe(200);
    const denied = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/realtime/credential' &&
        response.request().method() === 'POST' &&
        response.status() === 409,
    );
    await page.clock.setFixedTime(await page.evaluate(() => Date.now() + 6000));
    await page.bringToFront();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await denied;
    await expect.poll(() => heldSession).toBe(true);
    await expect(page.getByRole('button', { name: /Presence 0/ })).toBeVisible();
    await expect
      .poll(() =>
        fixture.db.realtimeLease.count({
          where: { userId: fixture.observers[0].userId, presenceExpiresAt: { gt: new Date() } },
        }),
      )
      .toBe(0);
    expect(
      await fixture.db.session.count({
        where: { id: fixture.observers[0].sessionId, expiresAt: { gt: new Date() } },
      }),
    ).toBe(1);
    release();
    await expect(page.getByRole('button', { name: /Presence 1/ })).toBeVisible();
    await expect
      .poll(() =>
        fixture.db.realtimeLease.count({
          where: { userId: fixture.observers[1].userId, presenceExpiresAt: { gt: new Date() } },
        }),
      )
      .toBe(1);
  } finally {
    release();
    await fixture.close();
  }
});
