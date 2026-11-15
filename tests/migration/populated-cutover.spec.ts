import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { client, configuration } from '../../scripts/migration/environment';
import { fixture, origin, sessions } from '../../scripts/migration/runtime';
import { sameSnapshot, snapshot } from '../../scripts/migration/snapshot';
import { transferState } from '../../scripts/migration/transfer';

async function preservedContext(browser: Browser, index: number) {
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${30 + index}` },
  });
  await context.addCookies(
    sessions()
      [index].cookie.split('; ')
      .map((part) => {
        const separator = part.indexOf('=');
        return { name: part.slice(0, separator), value: part.slice(separator + 1), url: origin };
      }),
  );
  return context;
}

test('migrated credentials, sessions, idempotency, catalog and private discovery remain authoritative', async ({
  browser,
}) => {
  const local = configuration();
  const data = fixture();
  const state = transferState();
  const target = client(local.targetUrl);
  const source = client(local.sourceUrl);
  const contexts: BrowserContext[] = [];
  try {
    for (let index = 0; index < 3; index++) contexts.push(await preservedContext(browser, index));
    for (const [index, context] of contexts.entries()) {
      const profile = await context.request.get('/api/profile');
      expect(profile.status()).toBe(index === 2 ? 401 : 200);
      if (index < 2) expect((await profile.json()).profile.userId).toBe(data.userIds[index]);
    }
    expect(await target.account.count()).toBe(8);
    expect(await target.user.count()).toBe(8);
    const beforeMessages = await target.message.count({ where: { matchId: data.matchId } });
    const beforeNotifications = await target.notification.count();
    const replay = await contexts[0].request.post('/api/messages', {
      data: {
        matchId: data.matchId,
        content: data.messageContent,
        clientRequestId: data.clientRequestId,
        expectedUserId: sessions()[0].userId,
        expectedSessionId: sessions()[0].sessionId,
      },
    });
    expect(replay.status()).toBe(201);
    expect((await replay.json()).id).toBe(data.messageId);
    expect(await target.message.count({ where: { matchId: data.matchId } })).toBe(beforeMessages);
    expect(await target.notification.count()).toBe(beforeNotifications);
    const pending = await target.messageDelivery.findMany({ where: { messageId: data.messageId } });
    expect(pending).toHaveLength(2);
    expect(pending.every((row) => row.completedAt !== null)).toBe(true);
    expect(
      (
        await target.file.findMany({
          where: { userId: data.userIds[0] },
          orderBy: { order: 'asc' },
        })
      ).map((row) => row.order),
    ).toEqual([0, 1]);
    const city = await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.34' },
    });
    contexts.push(city);
    expect(
      (
        await city.request.post('/api/auth/sign-in/email', {
          headers: { Origin: origin },
          data: { email: data.emails[2], password: 'IncorrectSyntheticPassword!' },
        })
      ).status(),
    ).toBe(401);
    const signed = await city.request.post('/api/auth/sign-in/email', {
      headers: { Origin: origin },
      data: { email: data.emails[2], password: data.password },
    });
    expect(signed.status()).toBe(200);
    expect((await signed.json()).user.id).toBe(data.userIds[2]);
    const own = await city.request.get('/api/profile/location');
    expect(await own.json()).toMatchObject({
      mode: 'CITY',
      revision: 9,
      showCity: true,
      showDistance: true,
    });
    const search = await city.request.get('/api/location/cities?q=Synthetic&country=PH');
    expect(search.status()).toBe(200);
    const cities = await search.json();
    const listed = cities.items;
    expect(listed.some((row: { id: string }) => row.id === data.cityIds[0])).toBe(true);
    expect(listed.some((row: { id: string }) => row.id === data.cityIds[1])).toBe(false);
    for (const [context, expectedId] of [
      [contexts[0], data.userIds[2]],
      [city, data.userIds[3]],
    ] as const) {
      const response = await context.request.get('/api/discover?distance=10');
      expect(response.status()).toBe(200);
      const body = await response.json();
      const profiles = Array.isArray(body) ? body : body.profiles;
      expect(profiles.some((row: { userId: string }) => row.userId === expectedId)).toBe(true);
      expect(
        profiles.every(
          (row: Record<string, unknown>) =>
            !['latitude', 'longitude', 'locationCityId', 'locationRevision'].some(
              (key) => key in row,
            ),
        ),
      ).toBe(true);
    }
    expect((await city.request.get(`/api/messages?matchId=${data.matchId}`)).status()).toBe(403);
    expect(
      (await target.locationCatalog.findUniqueOrThrow({ where: { id: 'geonames-cities500' } }))
        .cityCount,
    ).toBe(3);
    expect(await target.locationCityName.count()).toBe(6);
    expect(sameSnapshot(state.source!, await snapshot(source, local.sourceUrl))).toBe(true);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await target.$disconnect();
    await source.$disconnect();
  }
});

test('two preserved browser accounts exchange native live messages and retain restored history', async ({
  browser,
}) => {
  const data = fixture();
  const contexts = await Promise.all([preservedContext(browser, 0), preservedContext(browser, 1)]);
  let obsoleteRequests = 0;
  try {
    const pages = await Promise.all(contexts.map((context) => context.newPage()));
    for (const page of pages) {
      page.on('request', (request) => {
        if (/^\/(?:socket\.io\/|api\/socket\/token)/.test(new URL(request.url()).pathname))
          obsoleteRequests++;
      });
      const live = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/presence' && response.status() === 200,
      );
      await page.goto(`/messages/${data.matchId}`);
      await live;
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText('Synthetic migrated message 119', { exact: true }),
      ).toBeVisible();
    }
    const content = `Synthetic migrated browser live exchange ${randomUUID()}`;
    await pages[0].getByRole('textbox', { name: 'Message', exact: true }).fill(content);
    await pages[0].getByRole('button', { name: 'Send message', exact: true }).click();
    for (const page of pages)
      await expect(
        page
          .getByRole('log', { name: 'Conversation messages' })
          .getByText(content, { exact: true }),
      ).toHaveCount(1);
    await pages[1].reload();
    await expect(
      pages[1]
        .getByRole('log', { name: 'Conversation messages' })
        .getByText(content, { exact: true }),
    ).toHaveCount(1);
    expect(obsoleteRequests).toBe(0);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
