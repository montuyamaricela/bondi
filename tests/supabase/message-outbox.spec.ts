import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';

test('native managed outbox bounds claims, skips locked work and suppresses ended matches', async () => {
  if (!assertTestDatabase().native) throw new Error('Native Supabase required.');
  const db = new PrismaClient({ log: [] });
  const other = new PrismaClient({ log: [] });
  const suffix = randomUUID();
  const emails = [
    `bondi-e2e-${suffix}-outbox-a@example.test`,
    `bondi-e2e-${suffix}-outbox-b@example.test`,
  ];
  let paused = false;
  try {
    await db.$queryRaw`SELECT cron.unschedule('bondi-message-delivery')`;
    paused = true;
    const users = await Promise.all(emails.map((email) => db.user.create({ data: { email } })));
    const match = await db.match.create({ data: { user1Id: users[0].id, user2Id: users[1].id } });
    const session = await db.session.create({
      data: {
        userId: users[1].id,
        token: `synthetic-${suffix}`,
        expiresAt: new Date(Date.now() + 120_000),
      },
    });
    const topic = `bondi:${randomBytes(32).toString('hex')}`;
    await db.realtimeLease.create({
      data: {
        userId: users[1].id,
        sessionId: session.id,
        topic,
        expiresAt: new Date(Date.now() + 90_000),
      },
    });
    const queued = async () =>
      (
        await db.$queryRaw<
          Array<{ count: number }>
        >`SELECT count(*)::int AS count FROM realtime.messages WHERE topic = ${topic} AND event = 'changed'`
      )[0].count;
    const ids = Array.from({ length: 202 }, () => `synthetic-${randomUUID()}`);
    await db.message.createMany({
      data: ids.map((id) => ({
        id,
        senderId: users[0].id,
        matchId: match.id,
        type: 'TEXT',
        content: 'Synthetic bounded outbox fixture.',
      })),
    });
    await db.messageDelivery.createMany({
      data: ids.map((messageId) => ({ messageId, userId: users[1].id })),
    });
    await db.messageDelivery.update({
      where: { messageId_userId: { messageId: ids[0], userId: users[1].id } },
      data: { nextAttemptAt: new Date(0) },
    });
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "messageId" FROM "MessageDelivery" WHERE "messageId" = ${ids[0]} FOR UPDATE`;
      const result = await other.$queryRaw<
        Array<{ processed: number }>
      >`SELECT bondi_private.dispatch_message_hints() AS processed`;
      expect(result[0].processed).toBe(100);
      expect(
        (
          await tx.messageDelivery.findUniqueOrThrow({
            where: { messageId_userId: { messageId: ids[0], userId: users[1].id } },
          })
        ).completedAt,
      ).toBeNull();
    });
    const parallel = await Promise.all(
      [db, other].map(
        (client) =>
          client.$queryRaw<
            Array<{ processed: number }>
          >`SELECT bondi_private.dispatch_message_hints() AS processed`,
      ),
    );
    expect(parallel.every((rows) => rows[0].processed <= 100)).toBe(true);
    expect(parallel.reduce((sum, rows) => sum + rows[0].processed, 0)).toBe(102);
    expect(
      await db.messageDelivery.count({
        where: { messageId: { in: ids }, completedAt: { not: null }, attempts: 1 },
      }),
    ).toBe(202);
    expect(
      (
        await db.$queryRaw<
          Array<{ processed: number }>
        >`SELECT bondi_private.dispatch_message_hints() AS processed`
      )[0].processed,
    ).toBe(0);
    expect(await queued()).toBe(202);
    const ended = await db.message.create({
      data: {
        senderId: users[0].id,
        matchId: match.id,
        type: 'TEXT',
        content: 'Suppress queued ended-match communication.',
      },
    });
    await db.messageDelivery.create({ data: { messageId: ended.id, userId: users[1].id } });
    await db.match.update({ where: { id: match.id }, data: { status: 'UNMATCHED' } });
    expect(
      (
        await db.$queryRaw<
          Array<{ processed: number }>
        >`SELECT bondi_private.dispatch_message_hints(${ended.id}) AS processed`
      )[0].processed,
    ).toBe(1);
    expect(
      (
        await db.messageDelivery.findUniqueOrThrow({
          where: { messageId_userId: { messageId: ended.id, userId: users[1].id } },
        })
      ).completedAt,
    ).toBeInstanceOf(Date);
    expect(await db.message.count({ where: { matchId: match.id } })).toBe(203);
    expect(await queued()).toBe(202);
    await db.match.update({ where: { id: match.id }, data: { status: 'ACTIVE' } });
    const revoked = await db.message.create({
      data: {
        senderId: users[0].id,
        matchId: match.id,
        type: 'TEXT',
        content: 'Suppress a revoked queued audience.',
      },
    });
    await db.messageDelivery.create({ data: { messageId: revoked.id, userId: users[1].id } });
    await db.session.update({ where: { id: session.id }, data: { expiresAt: new Date(0) } });
    expect(
      (
        await db.$queryRaw<
          Array<{ processed: number }>
        >`SELECT bondi_private.dispatch_message_hints(${revoked.id}) AS processed`
      )[0].processed,
    ).toBe(1);
    expect(await queued()).toBe(202);
    const privileges = await db.$queryRaw<Array<{ anon: boolean; authenticated: boolean }>>`SELECT
      has_function_privilege('anon', 'bondi_private.dispatch_message_hints(text)', 'EXECUTE') AS anon,
      has_function_privilege('authenticated', 'bondi_private.dispatch_message_hints(text)', 'EXECUTE') AS authenticated`;
    expect(privileges).toEqual([{ anon: false, authenticated: false }]);
  } finally {
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
      if (paused)
        await db.$queryRaw`SELECT cron.schedule('bondi-message-delivery', '1 second', 'SELECT bondi_private.dispatch_message_hints()')`;
    } finally {
      await Promise.all([db.$disconnect(), other.$disconnect()]);
    }
  }
});
