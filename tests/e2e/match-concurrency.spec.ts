import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

test('mutual likes commit one canonical match and notifications or roll back together', async ({
  browser,
  baseURL,
  request,
}) => {
  test.setTimeout(120_000);
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const contexts = await Promise.all(
    [240, 241].map((ip) =>
      browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': `192.0.2.${ip}` } }),
    ),
  );
  const emails: string[] = [];
  const trigger = `bondi_e2e_match_${randomUUID().replaceAll('-', '')}`;
  const retryTrigger = `bondi_e2e_retry_${randomUUID().replaceAll('-', '')}`;
  const people: string[] = [];
  async function removeFailure() {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "Notification"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${trigger}"()`);
  }
  async function removeSerializationFailure() {
    await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${retryTrigger}" ON "Like"`);
    await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${retryTrigger}"()`);
    await db.$executeRawUnsafe(`DROP SEQUENCE IF EXISTS "${retryTrigger}_seq"`);
  }
  try {
    for (const [index, name] of ['Alice', 'Bob'].entries()) {
      const email = `bondi-e2e-${randomUUID()}-atomic-match@example.test`;
      emails.push(email);
      const response = await contexts[index].request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: { email, password: 'SyntheticAtomicMatch22!', name },
      });
      expect(response.status()).toBe(200);
      const userId = (await response.json()).user.id;
      people.push(userId);
      await db.profile.create({
        data: {
          userId,
          name,
          age: 28,
          bio: 'Synthetic atomic matching fixture.',
          gender: 'OTHER',
          interests: ['Music'],
          hobbies: ['Reading'],
          showOnlineStatus: false,
        },
      });
    }
    const [alice, bob] = people;
    const pairs = [
      { user1Id: alice, user2Id: bob },
      { user1Id: bob, user2Id: alice },
    ];
    async function action(index: number, value: 'LIKE' | 'PASS' = 'LIKE') {
      const response = await contexts[index].request.post('/api/discover', {
        data: { targetUserId: people[1 - index], action: value },
      });
      return { status: response.status(), body: await response.json() };
    }
    expect(
      (
        await request.post('/api/discover', { data: { targetUserId: bob, action: 'LIKE' } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await contexts[0].request.post('/api/discover', {
          data: { targetUserId: alice, action: 'LIKE' },
        })
      ).status(),
    ).toBe(400);
    // A sequence survives rollback, proving the real HTTP operation retried its failed transaction.
    expect(alice).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(`CREATE SEQUENCE "${retryTrigger}_seq"`);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${retryTrigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${alice}' AND nextval('"${retryTrigger}_seq"') = 1 THEN RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'synthetic serialization conflict'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${retryTrigger}" BEFORE INSERT ON "Like" FOR EACH ROW EXECUTE FUNCTION "${retryTrigger}"()`,
    );
    const recoveredLike = await action(0);
    const attempts = await db.$queryRawUnsafe<Array<{ last_value: bigint }>>(
      `SELECT last_value FROM "${retryTrigger}_seq"`,
    );
    expect({ status: recoveredLike.status, attempts: Number(attempts[0].last_value) }).toEqual({
      status: 200,
      attempts: 2,
    });
    expect(recoveredLike.body).toEqual({ matched: false });
    await removeSerializationFailure();
    // Fail the other participant's notification after the first insertion is attempted.
    // SQL identifiers and the predicate below contain only generated synthetic values.
    expect(alice).toMatch(/^[A-Za-z0-9_-]+$/);
    await db.$executeRawUnsafe(
      `CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."userId" = '${alice}' AND NEW."type" = 'MATCH' THEN RAISE EXCEPTION 'synthetic notification failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "Notification" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`,
    );
    expect((await action(1)).status).toBe(500);
    expect(await db.like.count({ where: { userId: bob, targetUserId: alice } })).toBe(0);
    expect(await db.match.count({ where: { OR: pairs } })).toBe(0);
    expect(await db.notification.count({ where: { userId: { in: people }, type: 'MATCH' } })).toBe(
      0,
    );
    await removeFailure();
    const recovered = await action(1);
    expect(recovered).toMatchObject({ status: 200, body: { matched: true } });
    const existing = await db.match.findUniqueOrThrow({ where: { id: recovered.body.matchId } });
    expect([existing.user1Id, existing.user2Id]).toEqual([...people].sort());
    expect(await db.notification.count({ where: { entityId: existing.id, type: 'MATCH' } })).toBe(
      2,
    );
    const retained = await db.notification.findFirstOrThrow({
      where: { entityId: existing.id, userId: bob, type: 'MATCH' },
    });
    await db.notification.update({ where: { id: retained.id }, data: { isRead: true } });
    await db.notification.deleteMany({
      where: { entityId: existing.id, userId: alice, type: 'MATCH' },
    });
    expect((await action(1)).body.matchId).toBe(existing.id);
    expect(await db.notification.count({ where: { entityId: existing.id, type: 'MATCH' } })).toBe(
      2,
    );
    expect((await db.notification.findUniqueOrThrow({ where: { id: retained.id } })).id).toBe(
      retained.id,
    );
    expect((await db.notification.findUniqueOrThrow({ where: { id: retained.id } })).isRead).toBe(
      true,
    );

    for (let round = 0; round < 50; round++) {
      await db.notification.deleteMany({ where: { userId: { in: people }, type: 'MATCH' } });
      await db.match.deleteMany({ where: { OR: pairs } });
      await db.like.deleteMany({ where: { userId: { in: people }, targetUserId: { in: people } } });
      const results = await Promise.all(Array.from({ length: 8 }, (_, index) => action(index % 2)));
      expect(results.map(({ status }) => status)).toEqual(Array(8).fill(200));
      const matches = await db.match.findMany({ where: { OR: pairs } });
      expect(matches).toHaveLength(1);
      expect(results.some(({ body }) => body.matched)).toBe(true);
      expect(
        new Set(results.filter(({ body }) => body.matched).map(({ body }) => body.matchId)),
      ).toEqual(new Set([matches[0].id]));
      for (const userId of people)
        expect(
          await db.notification.count({
            where: { entityId: matches[0].id, userId, type: 'MATCH' },
          }),
        ).toBe(1);
      expect(
        await db.like.count({ where: { userId: { in: people }, targetUserId: { in: people } } }),
      ).toBe(2);
      await expect(
        db.match.create({ data: { user1Id: matches[0].user2Id, user2Id: matches[0].user1Id } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await db.match.update({ where: { id: matches[0].id }, data: { status: 'UNMATCHED' } });
      expect(await action(0)).toMatchObject({ status: 200, body: { matched: false } });
      expect(await action(1)).toMatchObject({ status: 200, body: { matched: false } });
      expect(await db.match.count({ where: { OR: pairs } })).toBe(1);
      expect((await db.match.findUniqueOrThrow({ where: { id: matches[0].id } })).status).toBe(
        'UNMATCHED',
      );
      expect(
        await db.notification.count({ where: { entityId: matches[0].id, type: 'MATCH' } }),
      ).toBe(2);
    }
    await db.notification.deleteMany({ where: { userId: { in: people }, type: 'MATCH' } });
    await db.match.deleteMany({ where: { OR: pairs } });
    await db.like.deleteMany({ where: { userId: { in: people }, targetUserId: { in: people } } });
    expect(await action(0, 'PASS')).toMatchObject({ status: 200, body: { matched: false } });
    expect(await action(0, 'PASS')).toMatchObject({ status: 200, body: { matched: false } });
    expect(await action(1)).toMatchObject({ status: 200, body: { matched: false } });
    expect((await action(0)).status).toBe(400);
    expect(await db.match.count({ where: { OR: pairs } })).toBe(0);
  } finally {
    try {
      await removeFailure();
      await removeSerializationFailure();
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
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
