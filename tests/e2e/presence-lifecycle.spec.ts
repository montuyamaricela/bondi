import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { initializeSocket } from '../../lib/socket';
import { connect } from './socket-helpers';

const password = 'SyntheticPresence26!';
const invisible = { visible: false, online: false };

function testDatabase() {
  assertTestDatabase();
}

async function participants(browser: Browser, baseURL: string, db: PrismaClient, offset: number) {
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  const people: Array<{ id: string; email: string; token: string }> = [];
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
      const token = await context.request.get('/api/socket/token');
      expect(token.status()).toBe(200);
      people.push({ id, email, token: (await token.json()).token });
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

async function sync(client: Socket, userIds: string[], refreshOwn = false) {
  const result = await client.timeout(5000).emitWithAck('presence:sync', { userIds, refreshOwn });
  expect(result.ok).toBe(true);
  return result.statuses;
}

test('presence in every socket owner counts valid tabs and restricts snapshots and events', async ({
  browser,
  baseURL,
  request,
}) => {
  test.setTimeout(120_000);
  testDatabase();
  const db = new PrismaClient();
  const server = createServer();
  const initializer = initializeSocket(server);
  const clients: Socket[] = [];
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    for (const [runtime, url] of [
      baseURL!,
      'http://127.0.0.1:3101',
      `http://127.0.0.1:${address.port}`,
    ].entries()) {
      const fixture = await participants(browser, baseURL!, db, 120 + runtime * 6);
      contexts.push(...fixture.contexts);
      emails.push(...fixture.emails);
      const { people, match } = fixture;
      async function open(token: string) {
        const client = io(url, {
          auth: { token },
          autoConnect: false,
          reconnection: false,
          transports: ['websocket'],
          extraHeaders: { Origin: baseURL! },
        });
        clients.push(client);
        await connect(client);
        return client;
      }
      const observer = await open(people[0].token);
      const outsider = await open(people[2].token);
      const former = await open(people[3].token);
      const updates: Array<{ userId: string; visible: boolean; online: boolean }> = [];
      let privateLeaks = 0;
      observer.on('presence:updated', (update) => {
        if (update.userId === people[1].id) updates.push(update);
      });
      for (const client of [outsider, former]) {
        client.onAny((event, data) => {
          if (
            ['presence:updated', 'user:online', 'user:offline'].includes(event) &&
            data?.userId === people[1].id
          )
            privateLeaks++;
        });
      }
      const tab1 = await open(people[1].token);
      const tab2 = await open(people[1].token);
      expect(await sync(observer, [people[1].id, people[2].id])).toEqual({
        [people[1].id]: { visible: true, online: true },
        [people[2].id]: invisible,
      });
      expect(await sync(outsider, [people[1].id])).toEqual({ [people[1].id]: invisible });
      expect(await sync(former, [people[1].id])).toEqual({ [people[1].id]: invisible });
      expect(privateLeaks).toBe(0);
      expect(
        await observer
          .timeout(5000)
          .emitWithAck('presence:sync', { userIds: [''], refreshOwn: false }),
      ).toMatchObject({ ok: false });
      expect(
        (
          await request.post('/api/users/online-status', { data: { userIds: [people[1].id] } })
        ).status(),
      ).toBe(401);
      tab1.disconnect();
      expect(await sync(observer, [people[1].id])).toEqual({
        [people[1].id]: { visible: true, online: true },
      });
      await expect.poll(() => updates.at(-1)?.online).toBe(true);
      expect(updates.some(({ online }) => !online)).toBe(false);
      for (const visible of [false, true]) {
        expect(
          (
            await fixture.contexts[1].request.patch('/api/profile/privacy', {
              data: { showOnlineStatus: visible },
            })
          ).status(),
        ).toBe(200);
        await sync(tab2, [], true);
        await expect
          .poll(() => updates.at(-1))
          .toEqual({ userId: people[1].id, visible, online: visible });
        expect(await sync(observer, [people[1].id])).toEqual({
          [people[1].id]: visible ? { visible: true, online: true } : invisible,
        });
      }
      // Idle expired connections cannot make a queried user appear online.
      await db.session.updateMany({
        where: { userId: people[1].id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      expect(await sync(observer, [people[1].id])).toEqual({
        [people[1].id]: { visible: true, online: false },
      });
      let rejected = false;
      tab2.once('auth:error', () => {
        rejected = true;
      });
      tab2.emit('presence:sync', { userIds: [people[0].id] }, () => {});
      await expect.poll(() => rejected && !tab2.connected).toBe(true);
      await expect.poll(() => updates.at(-1)?.online).toBe(false);
      const renewed = await fixture.contexts[1].request.post('/api/auth/sign-in/email', {
        headers: { Origin: baseURL! },
        data: { email: people[1].email, password },
      });
      expect(renewed.status()).toBe(200);
      const tokenResponse = await fixture.contexts[1].request.get('/api/socket/token');
      expect(tokenResponse.status()).toBe(200);
      const renewedTab = await open((await tokenResponse.json()).token);
      await expect.poll(() => updates.at(-1)?.online).toBe(true);
      renewedTab.disconnect();
      await expect.poll(() => updates.at(-1)?.online).toBe(false);
      const activeAgain = await open((await tokenResponse.json()).token);
      await expect.poll(() => updates.at(-1)?.online).toBe(true);
      expect(
        (await fixture.contexts[0].request.patch(`/api/matches/${match.id}/unmatch`)).status(),
      ).toBe(200);
      observer.emit('match:leave', { matchId: match.id });
      await expect.poll(() => updates.at(-1)).toEqual({ userId: people[1].id, ...invisible });
      expect(await sync(observer, [people[1].id])).toEqual({ [people[1].id]: invisible });
      const endedCount = updates.filter(({ visible, online }) => visible || online).length;
      await sync(activeAgain, [], true);
      expect(updates.filter(({ visible, online }) => visible || online)).toHaveLength(endedCount);
      expect(privateLeaks).toBe(0);
      for (const client of [observer, outsider, former, activeAgain]) client.disconnect();
    }
  } finally {
    for (const client of clients) client.disconnect();
    await Promise.allSettled(contexts.map((context) => context.close()));
    await new Promise<void>((resolve) => {
      initializer.close(() => resolve());
    });
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});

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
