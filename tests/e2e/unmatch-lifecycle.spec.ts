import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { initializeSocket } from '../../lib/socket';
import { connect, joinRooms } from './socket-helpers';

async function participants(browser: Browser, baseURL: string, db: PrismaClient, offset: number) {
  const contexts: BrowserContext[] = [];
  const people: Array<{ userId: string; email: string; token: string }> = [];
  const emails: string[] = [];
  try {
    for (const [index, name] of ['Alice', 'Bob', 'Outsider'].entries()) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${offset + index}` },
      });
      contexts.push(context);
      const email = `bondi-e2e-${randomUUID()}-unmatch@example.test`;
      emails.push(email);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email, password: 'SyntheticUnmatch25!', name },
      });
      expect(response.status()).toBe(200);
      const userId = (await response.json()).user.id;
      people.push({ userId, email, token: '' });
      await db.profile.create({
        data: {
          userId,
          name,
          age: 28,
          bio: 'Synthetic unmatch lifecycle profile.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
      const token = await context.request.get('/api/socket/token');
      expect(token.status()).toBe(200);
      people[index].token = (await token.json()).token;
    }
    const match = await db.match.create({
      data: { user1Id: people[0].userId, user2Id: people[1].userId },
    });
    const message = await db.message.create({
      data: {
        matchId: match.id,
        senderId: people[1].userId,
        content: 'Existing permitted synthetic history',
      },
    });
    return { contexts, people, match, message };
  } catch (error) {
    await Promise.all(contexts.map((context) => context.close()));
    await db.user.deleteMany({ where: { email: { in: emails } } });
    throw error;
  }
}

function testDatabase() {
  const url = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(url.hostname);
  expect(url.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
}

test('all socket owners deny foreign typing and end live access without deleting history', async ({
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
  const allContexts: BrowserContext[] = [];
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
      const fixture = await participants(browser, baseURL!, db, 246 + runtime * 3);
      const { contexts, people, match, message } = fixture;
      allContexts.push(...contexts);
      emails.push(...people.map(({ email }) => email));
      const connected = [];
      for (const person of people) {
        const client = io(url, {
          auth: { token: person.token },
          autoConnect: false,
          reconnection: false,
          transports: ['websocket'],
          extraHeaders: { Origin: baseURL! },
        });
        clients.push(client);
        await connect(client);
        connected.push(client);
      }
      const [alice, bob, outsider] = connected;
      await joinRooms(alice, bob, match.id);
      if (runtime === 0) {
        await db.profile.update({
          where: { userId: people[1].userId },
          data: { showOnlineStatus: true },
        });
        const query = { data: { userIds: [people[1].userId] } };
        const foreignStatus = await contexts[2].request.post('/api/users/online-status', query);
        expect(await foreignStatus.json()).toEqual({ [people[1].userId]: false });
        const allowedStatus = await contexts[0].request.post('/api/users/online-status', query);
        expect(await allowedStatus.json()).toEqual({ [people[1].userId]: true });
      }
      let typing = 0;
      let receipts = 0;
      let outsiderErrors = 0;
      let aliceErrors = 0;
      const updates = [0, 0, 0];
      bob.on('typing:start', () => typing++);
      bob.on('typing:stop', () => typing++);
      bob.on('message:read', () => receipts++);
      outsider.on('match:error', () => outsiderErrors++);
      alice.on('match:error', () => aliceErrors++);
      connected.forEach((client, index) =>
        client.on('match:updated', (update) => {
          expect(update).toEqual({ matchId: match.id, status: 'UNMATCHED' });
          updates[index]++;
        }),
      );
      alice.emit('typing:start', { matchId: match.id });
      await expect.poll(() => typing).toBe(1);
      alice.emit('typing:stop', { matchId: match.id });
      await expect.poll(() => typing).toBe(2);
      alice.emit('message:read', { messageId: message.id });
      await expect.poll(() => receipts).toBe(1);
      expect((await db.message.findUniqueOrThrow({ where: { id: message.id } })).readAt).not.toBe(
        null,
      );
      await db.message.update({ where: { id: message.id }, data: { readAt: null } });
      const beforeForeign = typing;
      outsider.emit('typing:start', { matchId: match.id });
      await expect
        .poll(
          () =>
            typing > beforeForeign ? 'forwarded' : outsiderErrors > 0 ? 'rejected' : 'waiting',
          { message: `runtime ${runtime} must reject foreign typing` },
        )
        .toBe('rejected');
      outsider.emit('message:read', { messageId: message.id });
      await expect.poll(() => outsiderErrors).toBe(2);
      expect((await contexts[2].request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(
        403,
      );
      expect((await request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(401);
      expect(updates).toEqual([0, 0, 0]);
      expect((await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(
        200,
      );
      if (runtime === 0)
        await expect
          .poll(() => updates[0] > 0 && updates[1] > 0, {
            message: 'combined HTTP unmatch must publish across the app/server module boundary',
          })
          .toBe(true);
      // The connected UI also leaves its live room after HTTP success, reaching its selected owner.
      alice.emit('match:leave', { matchId: match.id });
      await expect.poll(() => updates[0] > 0 && updates[1] > 0).toBe(true);
      expect(updates[2]).toBe(0);
      const beforeClosed = typing;
      for (const [index, event] of ['typing:start', 'typing:stop', 'message:read'].entries()) {
        alice.emit(
          event,
          event === 'message:read' ? { messageId: message.id } : { matchId: match.id },
        );
        await expect.poll(() => aliceErrors).toBe(index + 1);
      }
      const sent = await alice.timeout(5000).emitWithAck('message:send', {
        matchId: match.id,
        content: 'Forbidden after unmatch',
        clientRequestId: randomUUID(),
      });
      expect(sent).toMatchObject({ ok: false, code: 'FORBIDDEN' });
      expect(await bob.timeout(5000).emitWithAck('match:join', { matchId: match.id })).toEqual({
        ok: false,
      });
      expect(typing).toBe(beforeClosed);
      if (runtime === 0) {
        const endedStatus = await contexts[0].request.post('/api/users/online-status', {
          data: { userIds: [people[1].userId] },
        });
        expect(await endedStatus.json()).toEqual({ [people[1].userId]: false });
      }
      expect(receipts).toBe(1);
      expect((await db.message.findUniqueOrThrow({ where: { id: message.id } })).readAt).toBe(null);
      expect(await db.message.count({ where: { matchId: match.id } })).toBe(1);
      for (const context of contexts.slice(0, 2)) {
        const history = await context.request.get(`/api/messages?matchId=${match.id}`);
        expect(history.status()).toBe(200);
        expect(await history.json()).toEqual([
          expect.objectContaining({ id: message.id, content: message.content }),
        ]);
      }
      expect((await contexts[2].request.get(`/api/messages?matchId=${match.id}`)).status()).toBe(
        403,
      );
      expect((await contexts[0].request.patch(`/api/matches/${match.id}/unmatch`)).status()).toBe(
        200,
      );
      await db.session.updateMany({
        where: { userId: people[0].userId },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      let denied = false;
      alice.once('auth:error', () => {
        denied = true;
      });
      alice.emit('typing:start', { matchId: match.id });
      await expect.poll(() => denied && !alice.connected).toBe(true);
      for (const client of connected) client.disconnect();
    }
  } finally {
    for (const client of clients) client.disconnect();
    await Promise.all(allContexts.map((context) => context.close()));
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

test('unmatching one open browser keeps both conversations visible and read-only', async ({
  browser,
  baseURL,
}) => {
  testDatabase();
  const db = new PrismaClient();
  let fixture: Awaited<ReturnType<typeof participants>> | undefined;
  try {
    fixture = await participants(browser, baseURL!, db, 246);
    const { contexts, match, message } = fixture;
    const pages = await Promise.all(contexts.slice(0, 2).map((context) => context.newPage()));
    for (const page of pages) {
      await page.goto(`/messages/${match.id}`);
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(message.content, { exact: true }),
      ).toBeVisible();
    }
    await pages[0].getByRole('button', { name: 'More options', exact: true }).click();
    await pages[0].getByRole('menuitem', { name: 'Unmatch', exact: true }).click();
    await pages[0]
      .getByRole('dialog')
      .getByRole('button', { name: 'Unmatch', exact: true })
      .click();
    for (const page of pages) {
      await expect(page).toHaveURL(new RegExp(`/messages/${match.id}$`));
      await expect(
        page.getByText('This match has ended. You can still read the conversation.', {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveCount(0);
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(message.content, { exact: true }),
      ).toHaveCount(1);
      await page.getByRole('button', { name: 'More options', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'Unmatch', exact: true })).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(1);
  } finally {
    if (fixture) {
      await Promise.all(fixture.contexts.map((context) => context.close()));
      await db.user.deleteMany({
        where: { email: { in: fixture.people.map(({ email }) => email) } },
      });
    }
    await db.$disconnect();
  }
});
