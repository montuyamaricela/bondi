import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

async function fixture(browser: Browser, baseURL: string, offset: number) {
  assertTestDatabase();
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-notification-inputs`;
  const contexts: BrowserContext[] = [];
  const people: string[] = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
      });
      contexts.push(context);
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: {
          email: `${prefix}-${index}@example.test`,
          name: `Notification owner ${index}`,
          password: 'SyntheticNotification38!',
        },
      });
      expect(response.status()).toBe(200);
      people.push((await response.json()).user.id);
    }
    const owned = Array.from({ length: 120 }, (_, index) => ({
      id: `${prefix}-${String(index).padStart(3, '0')}`,
      userId: people[0],
      type: 'SYSTEM' as const,
      title: 'Synthetic notification',
      content: 'Synthetic input validation record.',
      isRead: index % 2 === 0,
      createdAt: new Date('2020-01-01T00:00:00Z'),
    }));
    const foreign = Array.from({ length: 3 }, (_, index) => ({
      ...owned[index],
      id: `${prefix}-foreign-${index}`,
      userId: people[1],
      isRead: false,
    }));
    await db.notification.createMany({ data: [...owned, ...foreign] });
    return { db, contexts, people, owned, foreign, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test('notification lists bound strict limits and filters while retaining defaults, stable ties and owner isolation', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixtureData = await fixture(browser, baseURL!, 30);
  try {
    const { db, contexts, people, owned, foreign } = fixtureData;
    const path = '/api/notifications';
    const initial = await contexts[0].request.get(path);
    expect(initial.status()).toBe(200);
    expect((await initial.json()).notifications).toHaveLength(20);
    for (const limit of [
      '-1',
      '0',
      'not-a-number',
      '1.5',
      '1e2',
      '20x',
      '',
      ' ',
      '101',
      '1000000000',
      '9'.repeat(500),
    ]) {
      const response = await contexts[0].request.get(`${path}?limit=${encodeURIComponent(limit)}`);
      expect(response.status(), `invalid limit ${limit.slice(0, 20)}`).toBe(400);
    }
    for (const query of [
      'limit=10&limit=20',
      'unreadOnly=yes',
      'unreadOnly=',
      'unreadOnly=true&unreadOnly=false',
    ])
      expect((await contexts[0].request.get(`${path}?${query}`)).status()).toBe(400);
    const ordered = [...owned].reverse();
    for (const limit of [1, 20, 100]) {
      const response = await contexts[0].request.get(`${path}?limit=${limit}&userId=${people[1]}`);
      expect(response.status()).toBe(200);
      const rows = (await response.json()).notifications;
      expect(rows.map((row: { id: string }) => row.id)).toEqual(
        ordered.slice(0, limit).map((row) => row.id),
      );
      expect(rows.every((row: { userId: string }) => row.userId === people[0])).toBe(true);
    }
    const unread = await contexts[0].request.get(`${path}?unreadOnly=true&limit=100`);
    expect(unread.status()).toBe(200);
    expect((await unread.json()).notifications.map((row: { id: string }) => row.id)).toEqual(
      ordered.filter((row) => !row.isRead).map((row) => row.id),
    );
    const other = await contexts[1].request.get(`${path}?limit=100`);
    expect(other.status()).toBe(200);
    expect((await other.json()).notifications.map((row: { id: string }) => row.id).sort()).toEqual(
      foreign.map((row) => row.id).sort(),
    );
    expect((await request.get(`${path}?limit=invalid`)).status()).toBe(401);
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect((await contexts[0].request.get(path)).status()).toBe(401);
  } finally {
    await fixtureData.close();
  }
});

test('bulk read-state inputs are bounded and cannot mutate another account, including mark-all', async ({
  browser,
  baseURL,
  request,
}) => {
  const fixtureData = await fixture(browser, baseURL!, 32);
  try {
    const { db, contexts, people, owned, foreign } = fixtureData;
    const path = '/api/notifications';
    const snapshot = () =>
      db.notification.findMany({
        where: { userId: { in: people } },
        select: { id: true, isRead: true },
        orderBy: { id: 'asc' },
      });
    const before = await snapshot();
    const invalid: unknown[] = [
      { ids: '', isRead: true },
      { ids: ' ', isRead: true },
      { ids: 'x'.repeat(129), isRead: true },
      { ids: Array(101).fill(owned[1].id), isRead: true },
      { ids: [owned[1].id, null], isRead: true },
      { ids: [owned[1].id, 1], isRead: true },
      { ids: owned[1].id, isRead: 'true' },
      { ids: owned[1].id },
    ];
    for (const data of invalid) {
      expect((await contexts[0].request.patch(path, { data })).status()).toBe(400);
      expect(await snapshot()).toEqual(before);
    }
    expect(
      (
        await contexts[0].request.patch(path, {
          headers: { 'Content-Type': 'application/json' },
          data: Buffer.from('{'),
        })
      ).status(),
    ).toBe(400);
    expect(await snapshot()).toEqual(before);
    expect(
      (await contexts[0].request.patch(path, { data: { ids: [], isRead: true } })).status(),
    ).toBe(200);
    expect(await snapshot()).toEqual(before);
    expect(
      (
        await contexts[0].request.patch(path, {
          data: { ids: Array(100).fill(owned[1].id), isRead: true },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await contexts[0].request.patch(path, {
          data: { ids: [owned[3].id, foreign[0].id], isRead: true, userId: people[1] },
        })
      ).status(),
    ).toBe(200);
    expect((await db.notification.findUniqueOrThrow({ where: { id: owned[1].id } })).isRead).toBe(
      true,
    );
    expect((await db.notification.findUniqueOrThrow({ where: { id: owned[3].id } })).isRead).toBe(
      true,
    );
    expect((await db.notification.findUniqueOrThrow({ where: { id: foreign[0].id } })).isRead).toBe(
      false,
    );
    expect(
      (
        await contexts[0].request.patch(path, { data: { ids: owned[1].id, isRead: false } })
      ).status(),
    ).toBe(200);
    expect((await db.notification.findUniqueOrThrow({ where: { id: owned[1].id } })).isRead).toBe(
      false,
    );
    expect(
      (
        await contexts[0].request.patch(`${path}/mark-all-read`, { data: { userId: people[1] } })
      ).status(),
    ).toBe(200);
    expect(await db.notification.count({ where: { userId: people[0], isRead: false } })).toBe(0);
    expect(await db.notification.count({ where: { userId: people[1], isRead: false } })).toBe(3);
    expect(
      (await request.patch(path, { data: { ids: owned[0].id, isRead: false } })).status(),
    ).toBe(401);
    await db.session.updateMany({ where: { userId: people[0] }, data: { expiresAt: new Date(0) } });
    expect(
      (
        await contexts[0].request.patch(path, { data: { ids: owned[0].id, isRead: false } })
      ).status(),
    ).toBe(401);
    expect((await db.notification.findUniqueOrThrow({ where: { id: owned[0].id } })).isRead).toBe(
      true,
    );
  } finally {
    await fixtureData.close();
  }
});
