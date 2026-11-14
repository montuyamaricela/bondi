import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';
import { assertTestDatabase } from '../helpers/test-database';

class RollbackFixture extends Error {}

test('Realtime lease authorization uses UTC expiry in every database time zone', async () => {
  assertTestDatabase();
  const db = new PrismaClient({ log: [] });
  try {
    await db.$transaction(async (tx) => {
      const suffix = randomUUID();
      const user = await tx.user.create({
        data: { email: `bondi-e2e-${suffix}-policy@example.test` },
      });
      const session = await tx.session.create({
        data: {
          userId: user.id,
          token: `synthetic-${suffix}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const lease = await tx.realtimeLease.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          topic: `bondi:${randomBytes(32).toString('hex')}`,
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
      const claims = {
        iss: 'bondi-realtime',
        aud: 'authenticated',
        role: 'authenticated',
        sub: user.id,
        bondi_session: session.id,
        bondi_lease: lease.id,
        exp: Math.floor(Date.now() / 1000) + 60,
      };
      const allowed = async (value: unknown = claims, topic = lease.topic) => {
        await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify(value)}, true)`;
        const rows = await tx.$queryRaw<
          Array<{ allowed: boolean }>
        >`SELECT bondi_private.can_receive_realtime(${topic}) AS allowed`;
        return rows[0].allowed;
      };
      for (const timezone of ['UTC', 'Asia/Manila', 'America/Los_Angeles']) {
        await tx.$queryRaw`SELECT set_config('TimeZone', ${timezone}, true)`;
        expect(await allowed(), timezone).toBe(true);
        for (const change of [
          { iss: 'other' },
          { aud: 'other' },
          { role: 'anon' },
          { sub: 'other' },
          { bondi_session: 'other' },
          { bondi_lease: 'other' },
          { exp: 0 },
          { exp: null },
          { exp: undefined },
          { exp: 'invalid' },
        ])
          expect(await allowed({ ...claims, ...change })).toBe(false);
        expect(await allowed({}, lease.topic)).toBe(false);
        expect(await allowed(claims, 'other-topic')).toBe(false);
      }
      await tx.session.update({ where: { id: session.id }, data: { expiresAt: new Date(0) } });
      expect(await allowed()).toBe(false);
      await tx.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() + 60_000) },
      });
      await tx.realtimeLease.update({ where: { id: lease.id }, data: { expiresAt: new Date(0) } });
      expect(await allowed()).toBe(false);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  } finally {
    await db.$disconnect();
  }
});
