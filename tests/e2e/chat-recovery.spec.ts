import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type WebSocketRoute } from '@playwright/test';

test('populated chats reconcile missed history and preserve live messages during recovery', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  assertTestDatabase();
  const db = new PrismaClient();
  const contexts = await Promise.all(
    [230, 231].map((ip) =>
      browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` } }),
    ),
  );
  const emails: string[] = [];
  let releaseHistory = () => {};
  try {
    const people = [];
    for (const [index, name] of ['Alice', 'Bob'].entries()) {
      const email = `bondi-e2e-${randomUUID()}-recovery@example.test`;
      emails.push(email);
      const response = await contexts[index].request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: { email, password: 'SyntheticRecovery21!', name },
      });
      expect(response.status()).toBe(200);
      const userId = (await response.json()).user.id;
      await db.profile.create({
        data: {
          userId,
          name,
          age: 28,
          bio: 'Synthetic history recovery fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
      people.push(userId);
    }
    const match = await db.match.create({ data: { user1Id: people[0], user2Id: people[1] } });
    const baseline = 'Initial visible history';
    expect(
      (
        await contexts[1].request.post('/api/messages', {
          data: { matchId: match.id, content: baseline, clientRequestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    const alice = await contexts[0].newPage();
    const bob = await contexts[1].newPage();
    let blocked = false;
    let websocketReady = false;
    const connections: Array<{ client: WebSocketRoute; upstream: WebSocketRoute }> = [];
    await alice.route('**/socket.io/**', (route) => (blocked ? route.abort() : route.continue()));
    await alice.routeWebSocket('**/socket.io/**', (client) => {
      if (blocked) {
        void client.close();
        return;
      }
      const upstream = client.connectToServer();
      connections.push({ client, upstream });
      client.onMessage((data) => {
        if (data.toString() === '5') websocketReady = true;
        upstream.send(data);
      });
    });
    for (const page of [alice, bob]) {
      await page.goto(`/messages/${match.id}`);
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(baseline, { exact: true }),
      ).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeEnabled();
    }
    await expect.poll(() => websocketReady).toBe(true);
    const draft = 'A draft preserved through history reconciliation';
    await alice.getByRole('textbox', { name: 'Message', exact: true }).fill(draft);
    blocked = true;
    await Promise.all(
      connections.flatMap(({ client, upstream }) => [client.close(), upstream.close()]),
    );
    await expect(alice.getByRole('textbox', { name: 'Message', exact: true })).toBeDisabled();
    async function send(content: string) {
      await bob.getByRole('textbox', { name: 'Message', exact: true }).fill(content);
      await bob.getByRole('button', { name: 'Send message', exact: true }).click();
      await expect(bob.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
    }
    const missed = ['First missed message', 'Second missed message'];
    for (const content of missed) {
      await send(content);
      await expect(
        alice
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(content, { exact: true }),
      ).toHaveCount(0);
    }
    let captured = false;
    let completed = false;
    let holdNext = true;
    await alice.route('**/api/messages?*', async (route) => {
      if (!holdNext) {
        await route.continue();
        return;
      }
      holdNext = false;
      const response = await route.fetch();
      const snapshot = await response.json();
      const released = new Promise<void>((resolve) => {
        releaseHistory = resolve;
      });
      captured = true;
      await released;
      await route.fulfill({ response, json: snapshot });
      completed = true;
    });
    blocked = false;
    await expect
      .poll(() => captured, { message: 'socket recovery must refetch populated history' })
      .toBe(true);
    const duringFetch = 'A live message while older history is in flight';
    await send(duringFetch);
    await expect(
      alice
        .getByRole('log', { name: 'Conversation messages' })
        .getByText(duringFetch, { exact: true }),
    ).toBeVisible();
    releaseHistory();
    await expect.poll(() => completed).toBe(true);
    for (const page of [alice, bob]) {
      const log = page.getByRole('log', { name: 'Conversation messages' });
      for (const content of [baseline, ...missed, duringFetch])
        await expect(log.getByText(content, { exact: true })).toHaveCount(1);
      await expect(log.locator('p.whitespace-pre-wrap')).toHaveText([
        baseline,
        ...missed,
        duringFetch,
      ]);
    }
    await expect(alice.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(draft);
    await alice.getByRole('button', { name: 'Send message', exact: true }).click();
    for (const page of [alice, bob])
      await expect(
        page.getByRole('log', { name: 'Conversation messages' }).getByText(draft, { exact: true }),
      ).toHaveCount(1);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(5);
  } finally {
    releaseHistory();
    await Promise.all(contexts.map((context) => context.close()));
    try {
      await db.match.deleteMany({
        where: { OR: [{ user1: { email: { in: emails } } }, { user2: { email: { in: emails } } }] },
      });
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});
