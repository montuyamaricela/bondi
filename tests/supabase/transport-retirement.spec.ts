import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';
import { privateHintObserver } from '../helpers/realtime-observer';
import { publishRealtimeHint } from '../../lib/server/realtime';

async function participants(browser: Browser, baseURL: string, offset: number) {
  if (!assertTestDatabase().native) throw new Error('Native Supabase required.');
  const db = new PrismaClient({ log: [] });
  const contexts: BrowserContext[] = [];
  const observers: Awaited<ReturnType<typeof privateHintObserver>>[] = [];
  const prefix = `bondi-e2e-${randomUUID()}-retirement`;
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
    for (let index = 0; index < 4; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          password: 'SyntheticRetirement81!',
          name: `Retirement ${index}`,
        },
      });
      expect(response.status()).toBe(200);
      const observer = await privateHintObserver(context.request);
      observers.push(observer);
      await db.profile.create({
        data: {
          userId: observer.userId,
          name: `Retirement ${index}`,
          age: 28,
          gender: 'OTHER',
          bio: 'Synthetic transport retirement fixture.',
          interests: ['Music'],
          hobbies: ['Reading'],
        },
      });
    }
    const owners = observers.map(({ userId, sessionId }) => ({
      expectedUserId: userId,
      expectedSessionId: sessionId,
    }));
    return { db, contexts, observers, owners, close };
  } catch (error) {
    await close();
    throw error;
  }
}

type NotificationWindow = typeof window & { matchNotificationsShown: number };
test('standard Next has no retired endpoints or handshakes and native match notifications preserve preferences and deduplication', async ({
  browser,
  baseURL,
}) => {
  const f = await participants(browser, baseURL!, 126);
  try {
    const pages: Page[] = [];
    let obsoleteRequests = 0;
    let nativeConnections = 0;
    for (let index = 0; index < 2; index++) {
      await f.contexts[index].addInitScript(
        ({ enabled }) => {
          localStorage.setItem(
            'notificationSettings',
            JSON.stringify({ messageNotifications: true, matchNotifications: enabled }),
          );
          (window as NotificationWindow).matchNotificationsShown = 0;
          Object.defineProperty(window, 'Notification', {
            configurable: true,
            value: class {
              static permission = 'granted';
              constructor() {
                (window as NotificationWindow).matchNotificationsShown++;
              }
            },
          });
        },
        { enabled: index === 0 },
      );
      const page = await f.contexts[index].newPage();
      pages.push(page);
      page.on('request', (request) => {
        if (/^\/(?:socket\.io\/|api\/socket\/token)/.test(new URL(request.url()).pathname))
          obsoleteRequests++;
      });
      page.on('websocket', (socket) => {
        if (new URL(socket.url()).pathname === '/realtime/v1/websocket') nativeConnections++;
      });
      const baseline = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/notifications' && response.status() === 200,
      );
      await page.goto('/messages');
      expect((await (await baseline).json()).notifications).toEqual([]);
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          }),
      );
    }
    for (const path of ['/api/socket/token', '/socket.io/?EIO=4&transport=polling'])
      expect((await f.contexts[0].request.get(path)).status()).toBe(404);
    const like = async (actor: number, target: number) => {
      const response = await f.contexts[actor].request.post('/api/discover', {
        data: { action: 'LIKE', targetUserId: f.observers[target].userId },
      });
      expect(response.status()).toBe(200);
      return response.json();
    };
    expect(await like(0, 1)).toEqual({ matched: false });
    const match = await like(1, 0);
    expect(match.matched).toBe(true);
    for (const page of pages) {
      await expect(page.locator(`a[href="/messages/${match.matchId}"]`)).toBeVisible();
      await expect(
        page
          .getByRole('button', { name: 'Notifications', exact: true })
          .getByText('1', { exact: true }),
      ).toBeVisible();
    }
    await expect
      .poll(() => pages[0].evaluate(() => (window as NotificationWindow).matchNotificationsShown))
      .toBe(1);
    expect(
      await pages[1].evaluate(() => (window as NotificationWindow).matchNotificationsShown),
    ).toBe(0);
    const before = f.observers[0].hints;
    expect((await like(1, 0)).matchId).toBe(match.matchId);
    await Promise.all([
      publishRealtimeHint(f.observers[0].userId),
      publishRealtimeHint(f.observers[0].userId),
    ]);
    await expect.poll(() => f.observers[0].hints).toBeGreaterThan(before);
    expect(
      await pages[0].evaluate(() => (window as NotificationWindow).matchNotificationsShown),
    ).toBe(1);
    expect(
      await f.db.notification.count({ where: { type: 'MATCH', entityId: match.matchId } }),
    ).toBe(2);
    await pages[1].evaluate(() =>
      localStorage.setItem(
        'notificationSettings',
        JSON.stringify({ matchNotifications: true, messageNotifications: true }),
      ),
    );
    await like(1, 2);
    const foreignMatch = await like(2, 1);
    await expect
      .poll(() => pages[1].evaluate(() => (window as NotificationWindow).matchNotificationsShown))
      .toBe(1);
    expect(
      (await f.contexts[0].request.patch(`/api/matches/${match.matchId}/unmatch`)).status(),
    ).toBe(200);
    // The ended match already has its unique unread notification from discovery.
    for (const entityId of [foreignMatch.matchId, 'missing-match'])
      await f.db.notification.create({
        data: {
          userId: f.observers[0].userId,
          title: 'Synthetic stale match',
          content: 'Synthetic delayed match row',
          type: 'MATCH',
          entityId,
        },
      });
    await publishRealtimeHint(f.observers[0].userId);
    await expect(
      pages[0]
        .getByRole('button', { name: 'Notifications', exact: true })
        .getByText('3', { exact: true }),
    ).toBeVisible();
    const notifications = await f.contexts[0].request.get('/api/notifications');
    expect(
      (await notifications.json()).notifications.every(
        (row: { canNotify: boolean }) => row.canNotify === false,
      ),
    ).toBe(true);
    expect(
      await pages[0].evaluate(() => (window as NotificationWindow).matchNotificationsShown),
    ).toBe(1);
    await pages[0].reload();
    await expect(
      pages[0]
        .getByRole('button', { name: 'Notifications', exact: true })
        .getByText('3', { exact: true }),
    ).toBeVisible();
    expect(
      await pages[0].evaluate(() => (window as NotificationWindow).matchNotificationsShown),
    ).toBe(0);
    expect(obsoleteRequests).toBe(0);
    expect(nativeConnections).toBeGreaterThanOrEqual(2);
  } finally {
    await f.close();
  }
});

test('every native HTTP live operation rejects expired and revoked sessions on its next request', async ({
  browser,
  baseURL,
}) => {
  for (const [modeIndex, mode] of ['expired', 'revoked'].entries()) {
    const f = await participants(browser, baseURL!, 132 + modeIndex * 5);
    try {
      const [actor, peer, former] = f.observers;
      const match = await f.db.match.create({
        data: { user1Id: actor.userId, user2Id: peer.userId },
      });
      const otherMatch = await f.db.match.create({
        data: { user1Id: actor.userId, user2Id: former.userId },
      });
      const message = await f.db.message.create({
        data: { matchId: match.id, senderId: peer.userId, content: 'Synthetic incoming receipt' },
      });
      const owner = f.owners[0];
      const actions = [
        {
          method: 'POST',
          path: '/api/messages',
          data: {
            ...owner,
            matchId: match.id,
            content: 'Synthetic action matrix',
            clientRequestId: randomUUID(),
          },
          ok: 201,
        },
        {
          method: 'POST',
          path: `/api/matches/${match.id}/read`,
          data: { ...owner, ids: [message.id] },
          ok: 200,
        },
        {
          method: 'POST',
          path: `/api/matches/${match.id}/typing`,
          data: {
            ...owner,
            leaseId: actor.leaseId,
            viewId: randomUUID(),
            sequence: 1,
            typing: true,
          },
          ok: 200,
        },
        {
          method: 'GET',
          path: `/api/matches/${match.id}/typing?${new URLSearchParams(owner)}`,
          ok: 200,
        },
        {
          method: 'GET',
          path: `/api/messages?matchId=${match.id}&${new URLSearchParams(owner)}`,
          ok: 200,
        },
        {
          method: 'POST',
          path: '/api/presence',
          data: { ...owner, leaseId: actor.leaseId, sequence: 1 },
          ok: 200,
        },
        {
          method: 'POST',
          path: '/api/users/presence',
          data: { ...owner, userIds: [peer.userId] },
          ok: 200,
        },
        {
          method: 'POST',
          path: '/api/realtime/credential',
          data: { ...owner, leaseId: actor.leaseId },
          ok: 200,
        },
        {
          method: 'PATCH',
          path: '/api/profile/privacy',
          data: { ...owner, showOnlineStatus: true },
          ok: 200,
        },
      ];
      for (const action of actions)
        expect(
          (
            await f.contexts[0].request.fetch(action.path, {
              method: action.method,
              data: action.data,
            })
          ).status(),
          `${mode}: valid ${action.path}`,
        ).toBe(action.ok);
      expect(
        (
          await f.contexts[0].request.patch(`/api/matches/${otherMatch.id}/unmatch`, {
            data: owner,
          })
        ).status(),
      ).toBe(200);
      const before = await f.db.message.count({ where: { matchId: match.id } });
      if (mode === 'expired')
        await f.db.session.update({
          where: { id: actor.sessionId },
          data: { expiresAt: new Date(0) },
        });
      else await f.db.session.delete({ where: { id: actor.sessionId } });
      for (const action of actions)
        expect(
          (
            await f.contexts[0].request.fetch(action.path, {
              method: action.method,
              data: action.data,
            })
          ).status(),
          `${mode}: reject ${action.path}`,
        ).toBe(401);
      expect(
        (
          await f.contexts[0].request.patch(`/api/matches/${match.id}/unmatch`, { data: owner })
        ).status(),
      ).toBe(401);
      expect(await f.db.message.count({ where: { matchId: match.id } })).toBe(before);
      expect((await f.db.match.findUniqueOrThrow({ where: { id: match.id } })).status).toBe(
        'ACTIVE',
      );
      const beforeActor = actor.hints;
      const beforePeer = peer.hints;
      expect(
        (
          await f.contexts[1].request.post('/api/messages', {
            data: {
              matchId: match.id,
              content: 'Only a current session receives live hints',
              clientRequestId: randomUUID(),
            },
          })
        ).status(),
      ).toBe(201);
      await expect.poll(() => peer.hints).toBeGreaterThan(beforePeer);
      expect(actor.hints).toBe(beforeActor);
      const typing = await f.contexts[1].request.get(
        `/api/matches/${match.id}/typing?${new URLSearchParams(f.owners[1])}`,
      );
      expect(await typing.json()).toEqual({ typing: false, expiresAt: null });
    } finally {
      await f.close();
    }
  }
});
