import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { publishRealtimeHint } from '../../lib/server/realtime';

type Phase = 'response' | 'body' | 'request';
type Probe = {
  marker: string;
  held: boolean;
  tokenRequests: number;
  completedTokens: number;
  handshakes: number;
  releaseFirst: () => void;
};
type ProbeWindow = typeof window & { realtimeLifecycleProbe: Probe };
const password = 'SyntheticSocketOwner27!';

async function installProbe(page: Page, phase: Phase) {
  await page.addInitScript(
    ({ phase }) => {
      const state: Probe = {
        marker: crypto.randomUUID(),
        held: false,
        tokenRequests: 0,
        completedTokens: 0,
        handshakes: 0,
        releaseFirst: () => {},
      };
      (window as ProbeWindow).realtimeLifecycleProbe = state;
      const hold = async () => {
        state.held = true;
        await new Promise<void>((resolve) => {
          state.releaseFirst = resolve;
        });
        state.held = false;
      };
      const recordHandshake = (value: string | URL) => {
        const url = new URL(value, location.href);
        if (url.pathname === '/realtime/v1/websocket') state.handshakes++;
      };
      XMLHttpRequest.prototype.open = new Proxy(XMLHttpRequest.prototype.open, {
        apply(target, receiver, args) {
          recordHandshake(args[1]);
          return Reflect.apply(target, receiver, args);
        },
      });
      window.WebSocket = new Proxy(window.WebSocket, {
        construct(target, args, newTarget) {
          recordHandshake(args[0]);
          return Reflect.construct(target, args, newTarget);
        },
      });
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const value = typeof input === 'string' || input instanceof URL ? input : input.url;
        if (
          new URL(value, location.href).pathname !== '/api/realtime/credential' ||
          init?.method !== 'POST'
        )
          return nativeFetch(input, init);
        const first = ++state.tokenRequests === 1;
        if (first && phase === 'request') await hold();
        const response = await nativeFetch(input, init);
        // Buffer the real response; abort alone cannot cancel the later fixture continuation.
        await response.clone().arrayBuffer();
        state.completedTokens++;
        if (first && phase === 'response') await hold();
        if (first && phase === 'body') {
          const nativeJson = response.json.bind(response);
          response.json = async () => {
            const body = await nativeJson();
            await hold();
            return body;
          };
        }
        return response;
      };
    },
    { phase },
  );
}

async function probe(page: Page) {
  return page.evaluate(() => {
    const { marker, held, tokenRequests, completedTokens, handshakes } = (window as ProbeWindow)
      .realtimeLifecycleProbe;
    return { marker, held, tokenRequests, completedTokens, handshakes };
  });
}

async function flushEffects(page: Page) {
  // Drain committed session changes, native response parsing and React passive effects.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      }),
  );
}

async function release(page: Page) {
  await page.evaluate(() => (window as ProbeWindow).realtimeLifecycleProbe.releaseFirst());
  await flushEffects(page);
}

async function refreshSession(page: Page, name: string) {
  const response = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/auth/get-session' && response.status() === 200,
  );
  const later = await page.evaluate(() => Date.now() + 6000);
  await page.clock.setFixedTime(later);
  await page.bringToFront();
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await response;
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  await flushEffects(page);
}

async function participants(browser: Browser, baseURL: string, offset: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  const people: Array<{ id: string; email: string }> = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (const [index, name] of ['Alice', 'Bob', 'Observer'].entries()) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${offset + index}` },
      });
      contexts.push(context);
      const email = `bondi-e2e-${randomUUID()}-socket-owner@example.test`;
      emails.push(email);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email, password, name },
      });
      expect(response.status()).toBe(200);
      const id = (await response.json()).user.id;
      people.push({ id, email });
      await db.profile.create({
        data: {
          userId: id,
          name,
          age: 28,
          bio: 'Synthetic socket owner fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: true,
        },
      });
    }
    await db.match.createMany({
      data: people.slice(0, 2).map((person) => ({ user1Id: person.id, user2Id: people[2].id })),
    });
    const status = async () => {
      const result: Record<string, boolean> = {};
      for (const person of people.slice(0, 2))
        result[person.id] =
          (await db.realtimeLease.count({
            where: { userId: person.id, expiresAt: { gt: new Date() } },
          })) > 0;
      return result;
    };
    const signIn = async (index: number) => {
      await contexts[0].clearCookies();
      const response = await contexts[0].request.post('/api/auth/sign-in/email', {
        headers: { Origin: baseURL },
        data: { email: people[index].email, password },
      });
      expect(response.status()).toBe(200);
    };
    return { db, contexts, people, status, signIn, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('a native credential body completing after logout creates no connection', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 160);
  try {
    const page = await fixture.contexts[0].newPage();
    await installProbe(page, 'body');
    await page.goto('/settings');
    await expect.poll(async () => (await probe(page)).held).toBe(true);
    const initial = await probe(page);
    expect(initial.handshakes).toBe(0);
    await page.getByRole('button', { name: /Alice/ }).click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await flushEffects(page);
    expect((await probe(page)).marker).toBe(initial.marker);
    await release(page);
    expect((await probe(page)).handshakes).toBe(0);
  } finally {
    await fixture.close();
  }
});

test('a delayed old-account native credential response cannot create a valid orphan after account change', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 164);
  try {
    const page = await fixture.contexts[0].newPage();
    await installProbe(page, 'response');
    await page.goto('/settings');
    await expect.poll(async () => (await probe(page)).held).toBe(true);
    await fixture.signIn(1);
    await refreshSession(page, 'Bob');
    await expect.poll(async () => (await probe(page)).handshakes).toBe(1);
    expect(
      await fixture.db.session.count({
        where: { userId: fixture.people[0].id, expiresAt: { gt: new Date() } },
      }),
    ).toBeGreaterThan(0);
    const before = await probe(page);
    await release(page);
    expect((await probe(page)).handshakes).toBe(before.handshakes);
    expect((await probe(page)).handshakes).toBe(1);
  } finally {
    await fixture.close();
  }
});

test('session refresh preserves one connection while a replacement session gets a new owner', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 168);
  try {
    const page = await fixture.contexts[0].newPage();
    await installProbe(page, 'response');
    await page.goto('/settings');
    await expect.poll(async () => (await probe(page)).held).toBe(true);
    await release(page);
    await expect.poll(async () => (await probe(page)).handshakes).toBe(1);
    await expect
      .poll(fixture.status)
      .toEqual({ [fixture.people[0].id]: true, [fixture.people[1].id]: false });
    const session = await fixture.contexts[0].request.get('/api/auth/get-session');
    const originalId = (await session.json()).session.id;
    for (let index = 0; index < 2; index++) {
      const name = `Refreshed Alice ${index}`;
      const updated = await fixture.contexts[0].request.post('/api/auth/update-user', {
        headers: { Origin: baseURL! },
        data: { name },
      });
      expect(updated.status()).toBe(200);
      await refreshSession(page, name);
      expect((await probe(page)).tokenRequests).toBeGreaterThanOrEqual(1);
      expect((await probe(page)).handshakes).toBe(1);
    }
    await fixture.signIn(0);
    const replacement = await fixture.contexts[0].request.get('/api/auth/get-session');
    expect((await replacement.json()).session.id).not.toBe(originalId);
    const priorRequests = (await probe(page)).tokenRequests;
    await refreshSession(page, 'Refreshed Alice 1');
    await expect.poll(async () => (await probe(page)).tokenRequests).toBeGreaterThan(priorRequests);
    await expect.poll(async () => (await probe(page)).handshakes).toBe(2);
    await expect
      .poll(fixture.status)
      .toEqual({ [fixture.people[0].id]: true, [fixture.people[1].id]: false });
  } finally {
    await fixture.close();
  }
});

test('a native credential request belonging to a different cookie session is discarded before connecting', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 172);
  try {
    const page = await fixture.contexts[0].newPage();
    await installProbe(page, 'request');
    await page.goto('/settings');
    await expect.poll(async () => (await probe(page)).held).toBe(true);
    await fixture.signIn(1);
    await expect(page.getByRole('button', { name: /Alice/ })).toBeVisible();
    await release(page);
    await expect.poll(async () => (await probe(page)).completedTokens).toBe(1);
    await flushEffects(page);
    expect((await probe(page)).handshakes).toBe(0);
    await refreshSession(page, 'Bob');
    await expect.poll(async () => (await probe(page)).handshakes).toBe(1);
    await expect
      .poll(fixture.status)
      .toEqual({ [fixture.people[0].id]: false, [fixture.people[1].id]: true });
    expect((await probe(page)).handshakes).toBe(1);
  } finally {
    await fixture.close();
  }
});

test('a native browser receives empty hints, renews one channel, and recovers after a token failure', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 176);
  try {
    const page = await fixture.contexts[0].newPage();
    await installProbe(page, 'response');
    let notificationReads = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/notifications' && request.method() === 'GET')
        notificationReads++;
    });
    await page.goto('/settings');
    await expect.poll(async () => (await probe(page)).held).toBe(true);
    await release(page);
    await expect.poll(async () => (await probe(page)).handshakes).toBe(1);
    // Publish until the real join has completed, then observe an authorized HTTP refetch.
    await expect
      .poll(async () => {
        const before = notificationReads;
        await publishRealtimeHint(fixture.people[0].id);
        await page.waitForTimeout(100);
        return notificationReads > before;
      })
      .toBe(true);
    await page.route('**/api/realtime/credential', async (route) => {
      if (route.request().method() === 'POST')
        await route.fulfill({ status: 503, json: { error: 'Synthetic outage' } });
      else await route.continue();
    });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(async () => (await probe(page)).tokenRequests).toBeGreaterThan(1);
    await page.unroute('**/api/realtime/credential');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(async () => (await probe(page)).handshakes).toBe(2);
    const current = await probe(page);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(async () => (await probe(page)).completedTokens)
      .toBeGreaterThan(current.completedTokens);
    expect((await probe(page)).handshakes).toBe(2);
    const tokens = await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => /supabase|realtime|access.?token/i.test(key)),
    );
    expect(tokens).toHaveLength(0);
  } finally {
    await fixture.close();
  }
});
