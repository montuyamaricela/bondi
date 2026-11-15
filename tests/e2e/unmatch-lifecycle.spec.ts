import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

async function participants(browser: Browser, baseURL: string, db: PrismaClient, offset: number) {
  const contexts: BrowserContext[] = [];
  const people: Array<{ userId: string; email: string }> = [];
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
      people.push({ userId, email });
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
  assertTestDatabase();
}

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
