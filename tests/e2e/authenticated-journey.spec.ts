import { randomUUID } from 'node:crypto';
import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/lib/socket';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const password = 'SyntheticE2ePassword42!';

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/signup');
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/profile\/setup$/);
}

async function completeProfile(page: Page, name: string) {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByLabel('Age', { exact: true }).fill('28');
  await page.getByLabel('Bio').fill('A synthetic profile who enjoys music and reading.');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Select your interests', exact: true }).click();
  await page.getByRole('button', { name: 'Music', exact: true }).click();
  await page.getByRole('button', { name: 'Close options', exact: true }).click();
  await page.getByRole('button', { name: 'Select your hobbies', exact: true }).click();
  await page.getByRole('button', { name: 'Reading', exact: true }).click();
  await page.getByRole('button', { name: 'Close options', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page).toHaveURL(/\/discover$/);
  const response = await page.request.get('/api/profile');
  expect(response.status()).toBe(200);
  expect((await response.json()).profile).toMatchObject({
    name,
    age: 28,
    interests: ['Music'],
    hobbies: ['Reading'],
  });
}

test('two users onboard, match and chat while an outsider cannot access private data', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  // Cleanup is restricted to our exact synthetic emails in a local disposable database.
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const runId = randomUUID();
  const emails = ['alice', 'bob', 'outsider'].map(
    (name) => `bondi-e2e-${runId}-${name}@example.test`,
  );
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const pages: Page[] = [];
  const userIds: string[] = [];
  let outsiderSocket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;
  const outsiderMessages: string[] = [];
  try {
    for (const [index, context] of contexts.slice(0, 2).entries()) {
      const name = index === 0 ? 'E2E Alice' : 'E2E Bob';
      const page = await context.newPage();
      pages.push(page);
      await signUp(page, name, emails[index]);
      await completeProfile(page, name);
      await page.getByRole('button', { name: new RegExp(name) }).click();
      await page.getByRole('menuitem', { name: 'Logout' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto('/discover');
      await expect(page).toHaveURL(/\/login/);
      await page.getByLabel('Email', { exact: true }).fill(emails[index]);
      if (index === 0) {
        await page.getByLabel('Password', { exact: true }).fill('IncorrectE2ePassword42!');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible();
        expect((await page.request.get('/api/profile')).status()).toBe(401);
      }
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(/\/discover$/);
      const profile = (await (await context.request.get('/api/profile')).json()).profile;
      expect(profile.name).toBe(name);
      userIds.push(profile.userId);
    }
    const [alice, bob] = pages;
    const firstLike = await alice.request.post('/api/discover', {
      data: { targetUserId: userIds[1], action: 'LIKE' },
    });
    expect(firstLike.status()).toBe(200);
    expect(await firstLike.json()).toEqual({ matched: false });
    expect(await (await alice.request.get('/api/matches')).json()).toEqual([]);
    const mutualLike = await bob.request.post('/api/discover', {
      data: { targetUserId: userIds[0], action: 'LIKE' },
    });
    expect(mutualLike.status()).toBe(200);
    const match = await mutualLike.json();
    expect(match).toMatchObject({ matched: true, matchedUser: { id: userIds[0] } });
    const matchId: string = match.matchId;
    for (const [index, page] of pages.entries()) {
      const matches = await (await page.request.get('/api/matches')).json();
      expect(matches).toEqual([
        expect.objectContaining({
          matchId,
          user: expect.objectContaining({ id: userIds[1 - index] }),
        }),
      ]);
      await page.goto('/matches');
      await expect(
        page.getByRole('heading', { name: index === 0 ? 'E2E Bob' : 'E2E Alice', exact: true }),
      ).toBeVisible();
      await page.getByRole('link', { name: 'Message', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/messages/${matchId}$`));
      await expect(page.getByPlaceholder('Type a message...')).toBeEnabled();
    }
    const outsider = contexts[2];
    const registered = await outsider.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL! },
      data: { name: 'E2E Outsider', email: emails[2], password },
    });
    expect(registered.status()).toBe(200);
    expect((await registered.json()).user.email).toBe(emails[2]);
    for (const path of [`/api/matches/${matchId}`, `/api/messages?matchId=${matchId}`]) {
      const response = await outsider.request.get(path);
      expect(response.status()).toBe(403);
      expect(await response.json()).toEqual({ error: expect.any(String) });
    }
    expect(
      (
        await outsider.request.post('/api/messages', {
          data: { matchId, content: 'Forged HTTP message', senderId: userIds[0] },
        })
      ).status(),
    ).toBe(403);
    expect((await outsider.request.patch(`/api/matches/${matchId}/unmatch`)).status()).toBe(403);
    for (const path of ['/api/matches', '/api/matches/conversations']) {
      const response = await outsider.request.get(path);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual([]);
    }
    const ownProfile = await outsider.request.get(`/api/profile?userId=${userIds[0]}`);
    expect(ownProfile.status()).toBe(200);
    expect(await ownProfile.json()).toEqual({ profile: null });
    expect(
      (
        await alice.request.patch('/api/profile/location', {
          data: { latitude: 51.5, longitude: -0.1 },
        })
      ).status(),
    ).toBe(200);
    const storedLocation = await alice.request.get('/api/profile');
    expect(storedLocation.status()).toBe(200);
    expect((await storedLocation.json()).profile).toMatchObject({
      latitude: 51.5,
      longitude: -0.1,
    });
    const publicResponse = await outsider.request.get(`/api/profile/${userIds[0]}`);
    expect(publicResponse.status()).toBe(200);
    const publicProfile = (await publicResponse.json()).profile;
    expect(publicProfile).toMatchObject({ userId: userIds[0], name: 'E2E Alice' });
    for (const key of [
      'email',
      'latitude',
      'longitude',
      'lastLocationUpdate',
      'sessions',
      'accounts',
      'user',
    ]) {
      expect(publicProfile).not.toHaveProperty(key);
    }
    const tokenResponse = await outsider.request.get('/api/socket/token');
    expect(tokenResponse.status()).toBe(200);
    outsiderSocket = io(baseURL!, {
      auth: { token: (await tokenResponse.json()).token },
      autoConnect: false,
      reconnection: false,
      timeout: 5000,
    });
    outsiderSocket.on('message:new', (message) => outsiderMessages.push(message.content));
    await new Promise<void>((resolve, reject) => {
      outsiderSocket!.once('connect', () => resolve());
      outsiderSocket!.once('connect_error', reject);
      outsiderSocket!.connect();
    });
    expect(await outsiderSocket.timeout(5000).emitWithAck('match:join', { matchId })).toEqual({
      ok: false,
    });
    outsiderSocket.emit('message:send', { matchId, content: 'Forged socket message' }, () => {});

    await alice.getByPlaceholder('Type a message...').fill('Hello Bob, this is Alice.');
    await alice.getByPlaceholder('Type a message...').press('Enter');
    await expect(
      bob
        .getByRole('log', { name: 'Conversation messages' })
        .getByText('Hello Bob, this is Alice.', { exact: true }),
    ).toBeVisible();
    await bob.getByPlaceholder('Type a message...').fill('Hello Alice, this is Bob.');
    await bob.getByPlaceholder('Type a message...').press('Enter');
    await expect(
      alice
        .getByRole('log', { name: 'Conversation messages' })
        .getByText('Hello Alice, this is Bob.', { exact: true }),
    ).toBeVisible();
    for (const page of pages) {
      await page.reload();
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText('Hello Bob, this is Alice.', { exact: true }),
      ).toBeVisible();
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText('Hello Alice, this is Bob.', { exact: true }),
      ).toBeVisible();
      const history = await (await page.request.get(`/api/messages?matchId=${matchId}`)).json();
      expect(
        history.map((message: { content: string; senderId: string }) => ({
          content: message.content,
          senderId: message.senderId,
        })),
      ).toEqual([
        { content: 'Hello Bob, this is Alice.', senderId: userIds[0] },
        { content: 'Hello Alice, this is Bob.', senderId: userIds[1] },
      ]);
    }
    const notifications = await outsider.request.get(`/api/notifications?userId=${userIds[0]}`);
    expect(notifications.status()).toBe(200);
    expect(await notifications.json()).toEqual({ notifications: [] });
    expect(outsiderMessages).toEqual([]);
    const forbiddenAfterChat = await outsider.request.get(`/api/messages?matchId=${matchId}`);
    expect(forbiddenAfterChat.status()).toBe(403);
    expect(await forbiddenAfterChat.json()).toEqual({ error: expect.any(String) });
  } finally {
    outsiderSocket?.disconnect();
    try {
      await Promise.all(contexts.map((context) => context.close()));
    } finally {
      try {
        await db.match.deleteMany({
          where: {
            OR: [{ user1: { email: { in: emails } } }, { user2: { email: { in: emails } } }],
          },
        });
        await db.user.deleteMany({ where: { email: { in: emails } } });
      } finally {
        await db.$disconnect();
      }
    }
  }
});
