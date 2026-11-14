import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const password = 'SyntheticPresence26!';

function testDatabase() {
  assertTestDatabase();
}

async function participants(browser: Browser, baseURL: string, db: PrismaClient, offset: number) {
  const contexts: BrowserContext[] = [];
  const emails: string[] = [];
  const people: Array<{ id: string; email: string }> = [];
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
      people.push({ id, email });
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
