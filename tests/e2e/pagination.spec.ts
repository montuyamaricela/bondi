import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import type { CursorPage } from '../../lib/pagination';
import { readPagination } from '../../lib/server/cursor-pagination';
import { messageHistoryQuery } from '../../lib/server/message-history';
import { conversationPageQuery } from '../../lib/server/conversations';
import { receivedLikesQuery } from '../../lib/server/received-likes';
import { expect, test, type Browser } from '@playwright/test';

type PlanNode = {
  'Node Type': string;
  'Actual Rows': number;
  'Index Name'?: string;
  'Shared Hit Blocks': number;
  'Shared Read Blocks': number;
  Plans?: PlanNode[];
};
async function measureQuery(db: PrismaClient, query: Prisma.Sql) {
  const explained = await db.$queryRaw<
    Array<{
      'QUERY PLAN': Array<{ 'Execution Time': number; 'Planning Time': number; Plan: PlanNode }>;
    }>
  >(Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`);
  const plan = explained[0]['QUERY PLAN'][0];
  const nodes = (node: PlanNode): Array<{ type: string; rows: number; index?: string }> => [
    { type: node['Node Type'], rows: node['Actual Rows'], index: node['Index Name'] },
    ...(node.Plans ?? []).flatMap(nodes),
  ];
  expect(plan.Plan['Actual Rows']).toBe(51);
  return {
    returnedWithLookahead: plan.Plan['Actual Rows'],
    executionMs: plan['Execution Time'],
    planningMs: plan['Planning Time'],
    sharedHitBlocks: plan.Plan['Shared Hit Blocks'],
    sharedReadBlocks: plan.Plan['Shared Read Blocks'],
    nodes: nodes(plan.Plan),
  };
}

async function fixture(browser: Browser, baseURL: string, ip: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-pagination`;
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` },
  });
  const close = async () => {
    await context.close();
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    const response = await context.request.post('/api/auth/sign-up/email', {
      headers: { Origin: baseURL },
      data: {
        email: `${prefix}@example.test`,
        name: 'Pagination viewer',
        password: 'SyntheticPagination31!',
      },
    });
    expect(response.status()).toBe(200);
    const viewer = (await response.json()).user.id;
    const profile = {
      age: 28,
      bio: 'Synthetic pagination fixture.',
      gender: 'OTHER' as const,
      interests: ['Music'],
      hobbies: ['Reading'],
    };
    await db.profile.create({ data: { ...profile, userId: viewer, name: 'Pagination viewer' } });
    const peer = async (suffix: string) => {
      const id = `${prefix}-${suffix}`;
      await db.user.create({
        data: { id, email: `${id}@example.test`, name: `Peer ${suffix}`, emailVerified: false },
      });
      await db.profile.create({ data: { ...profile, userId: id, name: `Peer ${suffix}` } });
      return id;
    };
    const history = async (count: number) => {
      const other = await peer('history');
      const match = await db.match.create({
        data: {
          id: `${prefix}-history`,
          user1Id: viewer,
          user2Id: other,
          matchedAt: new Date('2000-01-01T00:00:00Z'),
        },
      });
      const ids = Array.from(
        { length: count },
        (_, index) => `${prefix}-m-${String(index).padStart(5, '0')}`,
      );
      await db.message.createMany({
        data: ids.map((id, index) => ({
          id,
          matchId: match.id,
          senderId: viewer,
          content: `History message ${String(index).padStart(5, '0')}`,
          createdAt: new Date('2001-01-01T00:00:00Z'),
        })),
      });
      return { match, ids, other };
    };
    return { db, context, viewer, peer, history, close, prefix };
  } catch (error) {
    await close();
    throw error;
  }
}

test('ten thousand tied history rows have bounded, gap-free cursor pages with latest messages first', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const owned = await fixture(browser, baseURL!, 212);
  try {
    const { context, history, db, viewer } = owned;
    const { match, ids } = await history(10_000);
    await db.message.updateMany({
      where: { id: { in: ids.slice(-100) } },
      data: { content: 'x'.repeat(5000) },
    });
    const initial = await context.request.get(`/api/messages?matchId=${match.id}`);
    expect(initial.status()).toBe(200);
    const first = await initial.json();
    expect(Array.isArray(first) ? first : first.items).toHaveLength(50);
    expect(first.items.map((message: { id: string }) => message.id)).toEqual(ids.slice(-50));
    const boundary = readPagination(
      new URLSearchParams({ cursor: first.nextCursor }),
      'messages',
      viewer,
      match.id,
    );
    for (const zone of ['UTC', 'Asia/Manila', 'America/New_York']) {
      const rows = await db.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT set_config('TimeZone', ${zone}, true)`;
        return transaction.$queryRaw<Array<{ id: string }>>(
          messageHistoryQuery(match.id, boundary),
        );
      });
      expect(rows[0].id, zone).toBe(ids.at(-51));
    }
    if (!boundary.cursor) throw new Error('Expected a history continuation');
    const historyPlans = [];
    for (const [name, pagination] of [
      ['first', readPagination(new URLSearchParams(), 'messages', viewer, match.id)],
      ['deep', { limit: 50, cursor: { ...boundary.cursor, id: ids[5000] } }],
    ] as const)
      historyPlans.push({
        page: name,
        fixtureRows: ids.length,
        ...(await measureQuery(db, messageHistoryQuery(match.id, pagination))),
      });
    await testInfo.attach('history-query-plans', {
      body: JSON.stringify(historyPlans),
      contentType: 'application/json',
    });
    const seen = new Set<string>();
    const cursors = new Set<string>();
    let cursor: string | null = null;
    let largestPageBytes = 0;
    do {
      const response = await context.request.get(
        `/api/messages?${new URLSearchParams({ matchId: match.id, limit: '100', ...(cursor ? { cursor } : {}) })}`,
      );
      expect(response.status()).toBe(200);
      const raw = await response.text();
      largestPageBytes = Math.max(largestPageBytes, Buffer.byteLength(raw));
      expect(Buffer.byteLength(raw)).toBeLessThan(1024 * 1024);
      const page: CursorPage<{ id: string }> = JSON.parse(raw);
      expect(page.items.length).toBeLessThanOrEqual(100);
      for (const message of page.items) {
        expect(seen.has(message.id)).toBe(false);
        seen.add(message.id);
      }
      cursor = page.nextCursor;
      if (cursor) {
        expect(cursors.has(cursor)).toBe(false);
        cursors.add(cursor);
      }
    } while (cursor);
    expect([...seen].sort()).toEqual(ids);
    await testInfo.attach('history-payload-budget', {
      body: JSON.stringify({
        rows: ids.length,
        defaultPage: 50,
        maximumPage: 100,
        largestPageBytes,
        byteBudget: 1024 * 1024,
      }),
      contentType: 'application/json',
    });
  } finally {
    await owned.close();
  }
});

test('inbox activity and received likes page in stable order without loading the complete lists', async ({
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(120_000);
  const owned = await fixture(browser, baseURL!, 213);
  try {
    const { db, viewer, peer, prefix, context } = owned;
    const matches: string[] = [];
    const likes: string[] = [];
    for (let index = 0; index < 120; index++) {
      const suffix = String(index).padStart(3, '0');
      const member = await peer(`inbox-${suffix}`);
      const match = await db.match.create({
        data: {
          id: `${prefix}-c-${suffix}`,
          user1Id: index % 2 ? viewer : member,
          user2Id: index % 2 ? member : viewer,
          matchedAt: new Date('2000-01-01T00:00:00Z'),
        },
      });
      matches.push(match.id);
      await db.message.create({
        data: {
          matchId: match.id,
          senderId: viewer,
          content: `Inbox ${suffix}`,
          createdAt: new Date(index === 0 ? '2025-01-01T00:00:00Z' : '2001-01-01T00:00:00Z'),
        },
      });
      const liker = await peer(`like-${suffix}`);
      likes.push(liker);
      await db.like.create({
        data: {
          id: `${prefix}-l-${suffix}`,
          userId: liker,
          targetUserId: viewer,
          action: 'LIKE',
          createdAt: new Date('2001-01-01T00:00:00Z'),
        },
      });
    }
    const idlePeer = await peer('idle');
    const idle = await db.match.create({
      data: {
        id: `${prefix}-idle`,
        user1Id: viewer,
        user2Id: idlePeer,
        matchedAt: new Date('2002-01-01T00:00:00Z'),
      },
    });
    const expected = [matches[0], idle.id, ...matches.slice(1).reverse()];
    const searched = await context.request.get('/api/matches/conversations?q=inbox');
    const searchedPage = await searched.json();
    expect(searchedPage.items).toHaveLength(50);
    expect(
      (
        await context.request.get(
          `/api/matches/conversations?q=Peer&cursor=${encodeURIComponent(searchedPage.nextCursor)}`,
        )
      ).status(),
    ).toBe(400);
    for (const q of ['%', '_']) {
      const literal = await context.request.get(
        `/api/matches/conversations?${new URLSearchParams({ q })}`,
      );
      expect(literal.status()).toBe(200);
      expect((await literal.json()).items).toHaveLength(0);
    }

    const queryReports = [];
    for (const [scope, sql] of [
      [
        'conversations',
        conversationPageQuery(
          viewer,
          readPagination(new URLSearchParams(), 'conversations', viewer),
        ),
      ],
      ['likes', receivedLikesQuery(viewer, readPagination(new URLSearchParams(), 'likes', viewer))],
    ] as const) {
      queryReports.push({
        scope,
        fixtureRows: scope === 'conversations' ? 121 : 120,
        ...(await measureQuery(db, sql)),
      });
    }
    await testInfo.attach('inbox-query-plans', {
      body: JSON.stringify(queryReports),
      contentType: 'application/json',
    });

    for (const [path, key, order] of [
      ['/api/matches/conversations', 'matchId', expected],
      ['/api/likes/received', 'userId', [...likes].reverse()],
    ] as const) {
      const initial = await context.request.get(path);
      expect(initial.status()).toBe(200);
      const body = await initial.json();
      expect(Array.isArray(body) ? body : body.items).toHaveLength(50);
      expect((await initial.body()).byteLength).toBeLessThan(1024 * 1024);
      const all: string[] = [];
      let cursor: string | null = null;
      do {
        const response = await context.request.get(
          `${path}?${new URLSearchParams({ limit: '17', ...(cursor ? { cursor } : {}) })}`,
        );
        expect(response.status()).toBe(200);
        const page: CursorPage<Record<string, string>> = await response.json();
        expect(page.items.length).toBeLessThanOrEqual(17);
        all.push(...page.items.map((item: Record<string, string>) => item[key]));
        expect(new Set(all).size).toBe(all.length);
        cursor = page.nextCursor;
      } while (cursor);
      expect(all).toEqual(order);
    }
    const page = await context.newPage();
    await page.goto('/messages');
    await expect(page.locator(`a[href="/messages/${matches[0]}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/messages/${matches[60]}"]`)).toHaveCount(0);
    await page.getByPlaceholder('Search conversations...').fill('Peer inbox-060');
    await expect(page.locator(`a[href="/messages/${matches[60]}"]`)).toBeVisible();
    await expect(page.locator('a[href^="/messages/"]')).toHaveCount(1);
    await page.getByPlaceholder('Search conversations...').fill('');
    await expect(page.locator(`a[href="/messages/${matches[0]}"]`)).toBeVisible();
    await expect(page.locator(`a[href="/messages/${matches[60]}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Load more conversations', exact: true }).click();
    await expect(page.locator(`a[href="/messages/${matches[60]}"]`)).toBeVisible();
    await page.getByRole('button', { name: 'Load more conversations', exact: true }).click();
    await expect(page.locator('a[href^="/messages/"]')).toHaveCount(121);
    await expect(
      page.getByRole('button', { name: 'Load more conversations', exact: true }),
    ).toHaveCount(0);
    await page.goto('/likes');
    await expect(page.getByRole('heading', { name: 'Peer like-119', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Peer like-060', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Load more likes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Peer like-060', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Load more likes', exact: true }).click();
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(120);
    await expect(page.getByRole('button', { name: 'Load more likes', exact: true })).toHaveCount(0);
  } finally {
    await owned.close();
  }
});

test('pagination validates cursors and bounds without weakening session or match ownership', async ({
  browser,
  baseURL,
  request,
}) => {
  const owned = await fixture(browser, baseURL!, 214);
  try {
    const { context, db, viewer, history, peer } = owned;
    const { match } = await history(51);
    const first = await context.request.get(`/api/messages?matchId=${match.id}`);
    const cursor = (await first.json()).nextCursor;
    expect(cursor).toEqual(expect.any(String));
    expect(
      (await context.request.get(`/api/matches/conversations?q=${'x'.repeat(101)}`)).status(),
    ).toBe(400);
    expect((await context.request.get('/api/matches/conversations?q=a&q=b')).status()).toBe(400);

    const bookmark = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    for (const patch of [
      { at: '0000-01-01T00:00:00.000Z' },
      { at: '2026-02-30T00:00:00.000Z' },
      { owner: 'another-account' },
      { resource: 'another-match' },
    ]) {
      const invalid = Buffer.from(JSON.stringify({ ...bookmark, ...patch })).toString('base64url');
      expect(
        (await context.request.get(`/api/messages?matchId=${match.id}&cursor=${invalid}`)).status(),
      ).toBe(400);
    }
    expect(
      (
        await context.request.get(
          `/api/messages?matchId=${match.id}&cursor=${cursor}&cursor=${cursor}`,
        )
      ).status(),
    ).toBe(400);

    for (const path of [
      `/api/messages?matchId=${match.id}&`,
      '/api/matches/conversations?',
      '/api/likes/received?',
    ]) {
      for (const query of [
        'limit=0',
        'limit=101',
        'limit=1.5',
        'limit=nope',
        'limit=',
        'limit=5&limit=6',
        'cursor=broken',
        'cursor=',
      ])
        expect((await context.request.get(`${path}${query}`)).status(), `${path}${query}`).toBe(
          400,
        );
    }
    expect((await request.get(`/api/messages?matchId=${match.id}`)).status()).toBe(401);
    const foreignA = await peer('foreign-a');
    const foreignB = await peer('foreign-b');
    const foreign = await db.match.create({ data: { user1Id: foreignA, user2Id: foreignB } });
    expect(
      (
        await context.request.get(
          `/api/messages?matchId=${foreign.id}&cursor=${encodeURIComponent(cursor)}`,
        )
      ).status(),
    ).toBe(403);
    expect(
      (
        await context.request.get(`/api/likes/received?cursor=${encodeURIComponent(cursor)}`)
      ).status(),
    ).toBe(400);
    await db.match.update({ where: { id: match.id }, data: { status: 'UNMATCHED' } });
    const retained = await context.request.get(
      `/api/messages?matchId=${match.id}&cursor=${encodeURIComponent(cursor)}`,
    );
    expect(retained.status()).toBe(200);
    expect((await retained.json()).items).toHaveLength(1);
    await db.session.updateMany({
      where: { userId: viewer },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    expect(
      (
        await context.request.get(
          `/api/messages?matchId=${match.id}&cursor=${encodeURIComponent(cursor)}`,
        )
      ).status(),
    ).toBe(401);
    for (const path of ['/api/matches/conversations', '/api/likes/received'])
      expect((await context.request.get(path)).status()).toBe(401);
  } finally {
    await owned.close();
  }
});

test('older browser history loads explicitly and preserves a draft and live arrival during pagination', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 215);
  let release: (() => void) | undefined;
  try {
    const { context, history } = owned;
    const { match } = await history(121);
    const page = await context.newPage();
    let held = false;
    await page.route('**/api/messages?**', async (route) => {
      const response = await route.fetch();
      if (new URL(route.request().url()).searchParams.has('cursor') && !held) {
        held = true;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      await route.fulfill({ response });
    });
    await page.goto(`/messages/${match.id}`);
    const log = page.getByRole('log', { name: 'Conversation messages' });
    await expect(log.getByText('History message 00120', { exact: true })).toHaveCount(1);
    await expect(log.getByText('History message 00000', { exact: true })).toHaveCount(0);
    const draft = 'Keep this draft while browsing older history';
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill(draft);
    await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
    await expect.poll(() => held).toBe(true);
    const anchor = log.locator('[data-message-id]').filter({ hasText: 'History message 00071' });
    const anchorBefore = await anchor.boundingBox();
    if (!anchorBefore) throw new Error('Expected the previous history window anchor');
    const live = 'Saved while the older history response is held';
    expect(
      (
        await context.request.post('/api/messages', {
          data: { matchId: match.id, content: live, clientRequestId: randomUUID() },
        })
      ).status(),
    ).toBe(201);
    await expect(log.getByText(live, { exact: true })).toHaveCount(1);
    release?.();
    release = undefined;
    await expect(log.getByText('History message 00021', { exact: true })).toHaveCount(1);
    await expect
      .poll(async () => Math.abs((await anchor.boundingBox())!.y - anchorBefore.y))
      .toBeLessThan(2);
    await expect(log.getByText(live, { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Load older messages', exact: true }).click();
    await expect(log.getByText('History message 00000', { exact: true })).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Load older messages', exact: true }),
    ).toHaveCount(0);
    expect(await log.getByText(/^History message \d{5}$/).allTextContents()).toEqual(
      Array.from(
        { length: 121 },
        (_, index) => `History message ${String(index).padStart(5, '0')}`,
      ),
    );
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue(draft);
    await expect(log.getByText(live, { exact: true })).toHaveCount(1);
  } finally {
    release?.();
    await owned.close();
  }
});
