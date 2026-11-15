import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { privateHintObserver } from '../helpers/realtime-observer';
import { publishRealtimeHint } from '../../lib/server/realtime';

async function participants(browser: Browser, baseURL: string, offset: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  const people: Array<{ id: string }> = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (const [index, name] of ['Alice', 'Bob', 'Outsider'].entries()) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${offset + index}` },
      });
      contexts.push(context);
      const email = `bondi-e2e-${randomUUID()}-delivery@example.test`;
      emails.push(email);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email, name, password: 'SyntheticDelivery28!' },
      });
      expect(response.status()).toBe(200);
      const id = (await response.json()).user.id;
      people.push({ id });
      await db.profile.create({
        data: {
          userId: id,
          name,
          age: 28,
          bio: 'Synthetic delivery fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
    }
    const match = await db.match.create({ data: { user1Id: people[0].id, user2Id: people[1].id } });
    return { db, contexts, people, match, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('HTTP sends update both private inbox streams and sender devices without opening chat', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixtures: Array<Awaited<ReturnType<typeof participants>>> = [];
  const observers: Array<Awaited<ReturnType<typeof privateHintObserver>>> = [];
  try {
    for (let fixtureIndex = 0; fixtureIndex < 3; fixtureIndex++) {
      const fixture = await participants(browser, baseURL!, 180 + fixtureIndex * 4);
      fixtures.push(fixture);
      const { db, contexts, people, match } = fixture;
      const native = await Promise.all(
        [contexts[0], contexts[1], contexts[0], contexts[2]].map((context) =>
          privateHintObserver(context.request),
        ),
      );
      observers.push(...native);
      for (const attempt of ['HTTP first', 'HTTP second']) {
        const before = native.map((observer) => observer.hints);
        const payload = {
          matchId: match.id,
          content: `Native off-room ${attempt} fixture ${fixtureIndex}`,
          clientRequestId: randomUUID(),
        };
        const response = await contexts[0].request.post('/api/messages', { data: payload });
        expect(response.status()).toBe(201);
        const id: string = (await response.json()).id;
        for (const index of [0, 1, 2])
          await expect.poll(() => native[index].hints).toBeGreaterThan(before[index]);
        for (const context of contexts.slice(0, 2)) {
          const history = await context.request.get(`/api/messages?matchId=${match.id}`);
          expect(history.status()).toBe(200);
          expect(
            (await history.json()).items.some((message: { id: string }) => message.id === id),
          ).toBe(true);
          const inbox = await context.request.get('/api/matches/conversations');
          expect(inbox.status()).toBe(200);
          expect(JSON.stringify((await inbox.json()).items)).toContain(id);
        }
        const stored = await db.notification.findMany({
          where: { userId: people[1].id, type: 'MESSAGE', entityId: match.id },
        });
        expect(stored).toHaveLength(attempt === 'HTTP first' ? 1 : 2);
        const replay = await contexts[0].request.post('/api/messages', { data: payload });
        expect(replay.status()).toBe(201);
        expect((await replay.json()).id).toBe(id);
        expect(
          await db.message.count({
            where: { matchId: match.id, clientRequestId: payload.clientRequestId },
          }),
        ).toBe(1);
        expect(
          await db.notification.count({ where: { entityId: match.id, type: 'MESSAGE' } }),
        ).toBe(stored.length);
        expect(
          await db.messageDelivery.count({
            where: { messageId: id },
          }),
        ).toBe(2);
      }
      expect(
        (
          await contexts[2].request.post('/api/messages', {
            data: { matchId: match.id, content: 'Foreign send' },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await request.post('/api/messages', {
            data: { matchId: match.id, content: 'Missing session' },
          })
        ).status(),
      ).toBe(401);
      const receiverHints = native[1].hints;
      await db.session.updateMany({
        where: { userId: people[1].id },
        data: { expiresAt: new Date(0) },
      });
      const senderHints = native[2].hints;
      expect(
        (
          await contexts[0].request.post('/api/messages', {
            data: {
              matchId: match.id,
              content: 'Only valid native sessions receive hints',
              clientRequestId: randomUUID(),
            },
          })
        ).status(),
      ).toBe(201);
      await expect.poll(() => native[2].hints).toBeGreaterThan(senderHints);
      expect(native[1].hints).toBe(receiverHints);
      expect(native[3].hints).toBe(0);
      expect(
        await db.notification.count({ where: { userId: people[0].id, type: 'MESSAGE' } }),
      ).toBe(0);
      expect((await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(
        200,
      );
      expect(
        (
          await contexts[0].request.post('/api/messages', {
            data: { matchId: match.id, content: 'No communication after unmatch' },
          })
        ).status(),
      ).toBe(403);
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(3);
      for (const observer of native) await observer.close();
    }
  } finally {
    await Promise.allSettled(observers.map((observer) => observer.close()));
    for (const fixture of fixtures) await fixture.close();
  }
});

type NotificationWindow = typeof window & { deliveryNotificationsShown: number };

async function nativeRecovery(fixture: Awaited<ReturnType<typeof participants>>) {
  const { db, contexts, people, match } = fixture;
  const trigger = `bondi_e2e_native_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "MessageDelivery"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  let observer: Awaited<ReturnType<typeof privateHintObserver>> | undefined;
  let paused = false;
  try {
    const historical = await contexts[0].request.post('/api/messages', {
      data: {
        matchId: match.id,
        content: 'Stored while both native browsers were offline',
        clientRequestId: randomUUID(),
      },
    });
    expect(historical.status()).toBe(201);
    await contexts[1].addInitScript(() => {
      localStorage.setItem('notificationSettings', JSON.stringify({ messageNotifications: true }));
      (window as NotificationWindow).deliveryNotificationsShown = 0;
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: class {
          static permission = 'granted';
          constructor() {
            (window as NotificationWindow).deliveryNotificationsShown++;
          }
        },
      });
    });
    const page = await contexts[1].newPage();
    let subscribed = false;
    page.on('websocket', (socket) => {
      if (new URL(socket.url()).pathname !== '/realtime/v1/websocket') return;
      socket.on('framereceived', ({ payload }) => {
        const frame = String(payload);
        if (frame.includes('"phx_reply"') && frame.includes('"status":"ok"')) subscribed = true;
      });
    });
    await page.goto('/messages');
    await expect(page.locator(`a[href="/messages/${match.id}"]`)).toBeVisible();
    await expect.poll(() => subscribed).toBe(true);
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`a[href="/messages/${match.id}"]`)).toContainText(
      'Stored while both native browsers were offline',
    );
    expect(
      await page.evaluate(() => (window as NotificationWindow).deliveryNotificationsShown),
    ).toBe(0);
    observer = await privateHintObserver(contexts[1].request);
    await db.$queryRaw`SELECT cron.unschedule('bondi-message-delivery')`;
    paused = true;
    expect(people[1].id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[1].id}' AND NEW."completedAt" IS NOT NULL THEN RAISE EXCEPTION 'synthetic native completion failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE UPDATE ON "MessageDelivery" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const content = 'Recover committed native delivery after managed relay restart';
    const payload = { matchId: match.id, content, clientRequestId: randomUUID() };
    const response = await contexts[0].request.post('/api/messages', { data: payload });
    expect(response.status()).toBe(201);
    const message = await response.json();
    const key = { messageId_userId: { messageId: message.id, userId: people[1].id } };
    expect(await db.messageDelivery.findUniqueOrThrow({ where: key })).toMatchObject({
      completedAt: null,
      attempts: 1,
    });
    expect(observer.hints).toBe(0);
    await db.messageDelivery.update({ where: key, data: { nextAttemptAt: new Date(0) } });
    const claims = await Promise.all(
      [0, 1].map(
        () =>
          db.$queryRaw<
            Array<{ processed: number }>
          >`SELECT bondi_private.dispatch_message_hints(${message.id}) AS processed`,
      ),
    );
    expect(claims.reduce((count, rows) => count + rows[0].processed, 0)).toBe(1);
    expect(await db.messageDelivery.findUniqueOrThrow({ where: key })).toMatchObject({
      completedAt: null,
      attempts: 2,
    });
    expect(observer.hints).toBe(0);
    await removeFailure();
    await db.messageDelivery.update({ where: key, data: { nextAttemptAt: new Date(0) } });
    await db.$queryRaw`SELECT cron.schedule('bondi-message-delivery', '1 second', 'SELECT bondi_private.dispatch_message_hints()')`;
    paused = false;
    await expect
      .poll(
        async () =>
          (await db.messageDelivery.findUniqueOrThrow({ where: key })).completedAt instanceof Date,
      )
      .toBe(true);
    await expect.poll(() => observer!.hints).toBeGreaterThan(0);
    await expect(page.locator(`a[href="/messages/${match.id}"]`)).toContainText(content);
    await expect
      .poll(() => page.evaluate(() => (window as NotificationWindow).deliveryNotificationsShown))
      .toBe(1);
    await Promise.all([publishRealtimeHint(people[1].id), publishRealtimeHint(people[1].id)]);
    await expect.poll(() => observer!.hints).toBeGreaterThanOrEqual(3);
    expect(
      await page.evaluate(() => (window as NotificationWindow).deliveryNotificationsShown),
    ).toBe(1);
    const replay = await contexts[0].request.post('/api/messages', { data: payload });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(message.id);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(2);
    expect(await db.notification.count({ where: { userId: people[1].id, type: 'MESSAGE' } })).toBe(
      2,
    );
  } finally {
    await removeFailure();
    if (paused)
      await db.$queryRaw`SELECT cron.schedule('bondi-message-delivery', '1 second', 'SELECT bondi_private.dispatch_message_hints()')`;
    await observer?.close();
  }
}

test('both off-room browser inboxes and notifications update while browser preferences remain effective', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 192);
  try {
    const { contexts, people, match, db } = fixture;
    await contexts[1].addInitScript(() => {
      localStorage.setItem(
        'notificationSettings',
        JSON.stringify({ messageNotifications: false, matchNotifications: true }),
      );
      (window as NotificationWindow).deliveryNotificationsShown = 0;
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: class {
          static permission = 'granted';
          static async requestPermission() {
            return 'granted';
          }
          constructor() {
            (window as NotificationWindow).deliveryNotificationsShown++;
          }
        },
      });
    });
    const pages = await Promise.all(contexts.slice(0, 2).map((context) => context.newPage()));
    for (const page of pages) {
      await page.goto('/messages');
      await expect(page.locator(`a[href="/messages/${match.id}"]`)).toBeVisible();
    }
    const first = 'A committed HTTP send outside the chat';
    const response = await contexts[0].request.post('/api/messages', {
      data: { matchId: match.id, content: first, clientRequestId: randomUUID() },
    });
    expect(response.status()).toBe(201);
    for (const page of pages)
      await expect(page.locator(`a[href="/messages/${match.id}"]`)).toContainText(first);
    await expect(
      pages[1]
        .getByRole('button', { name: 'Notifications', exact: true })
        .getByText('1', { exact: true }),
    ).toBeVisible();
    expect(
      await pages[1].evaluate(() => (window as NotificationWindow).deliveryNotificationsShown),
    ).toBe(0);
    await pages[1].evaluate(() =>
      localStorage.setItem(
        'notificationSettings',
        JSON.stringify({ messageNotifications: true, matchNotifications: true }),
      ),
    );
    const second = 'A second committed HTTP send outside the chat';
    const saved = await contexts[0].request.post('/api/messages', {
      data: {
        matchId: match.id,
        content: second,
        clientRequestId: randomUUID(),
      },
    });
    expect(saved.status()).toBe(201);
    for (const page of pages)
      await expect(page.locator(`a[href="/messages/${match.id}"]`)).toContainText(second);
    await expect(
      pages[1]
        .getByRole('button', { name: 'Notifications', exact: true })
        .getByText('2', { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        pages[1].evaluate(() => (window as NotificationWindow).deliveryNotificationsShown),
      )
      .toBe(1);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(2);
    expect(await db.notification.count({ where: { userId: people[1].id, type: 'MESSAGE' } })).toBe(
      2,
    );
  } finally {
    await fixture.close();
  }
});

test('a notification write failure rolls back the send and its same-ID retry recovers', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 196);
  const trigger = `bondi_e2e_delivery_${randomUUID().replaceAll('-', '')}`;
  const removeFailure = async () => {
    await fixture.db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Notification"`);
    await fixture.db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  };
  try {
    const { db, contexts, people, match } = fixture;
    expect(people[1].id).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${people[1].id}' AND NEW."type" = 'MESSAGE' THEN RAISE EXCEPTION 'synthetic message notification failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    const payload = {
      matchId: match.id,
      content: 'Recover the complete committed send',
      clientRequestId: randomUUID(),
    };
    expect((await contexts[0].request.post('/api/messages', { data: payload })).status()).toBe(500);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(0);
    expect(await db.notification.count({ where: { entityId: match.id } })).toBe(0);
    expect(
      await db.messageDelivery.count({
        where: { userId: { in: people.map((person) => person.id) } },
      }),
    ).toBe(0);
    await removeFailure();
    const response = await contexts[0].request.post('/api/messages', { data: payload });
    expect(response.status()).toBe(201);
    const replay = await contexts[0].request.post('/api/messages', { data: payload });
    expect((await replay.json()).id).toBe((await response.json()).id);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(1);
    expect(await db.messageDelivery.count({ where: { message: { matchId: match.id } } })).toBe(2);
    expect(
      await db.notification.count({ where: { userId: people[1].id, entityId: match.id } }),
    ).toBe(1);
  } finally {
    await removeFailure();
    await fixture.close();
  }
});

test('pending delivery survives managed relay restart and repeated hints show one browser notification', async ({
  browser,
  baseURL,
}) => {
  const fixture = await participants(browser, baseURL!, 200);
  try {
    await nativeRecovery(fixture);
  } finally {
    await fixture.close();
  }
});
