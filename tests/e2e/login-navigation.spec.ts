import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const password = 'SyntheticNavigation37!';
const fields = (name: string) => ({
  name,
  age: 28,
  bio: 'Synthetic authentication navigation verification.',
  gender: 'OTHER',
  interests: ['Music'],
  hobbies: ['Reading'],
  relationshipType: 'FRIENDSHIP',
  genderPreference: 'EVERYONE',
});
async function fixture(browser: Browser, baseURL: string, offset: number) {
  const database = new URL(process.env.DATABASE_URL || '');
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(database.hostname);
  expect(database.pathname.slice(1)).toMatch(/(?:^|[_-])(?:test|e2e|harness)(?:[_-]|$)/i);
  const db = new PrismaClient();
  const prefix = `bondi-e2e-${randomUUID()}-navigation`;
  const contexts: BrowserContext[] = [];
  const people: Array<{ id: string; email: string }> = [];
  const close = async () => {
    await Promise.allSettled(contexts.map((context) => context.close()));
    try {
      await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
    } finally {
      await db.$disconnect();
    }
  };
  try {
    for (let index = 0; index < 3; index++) {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${offset + index}` },
      });
      contexts.push(context);
      const email = `${prefix}-${index}@example.test`;
      const response = await context.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL },
        data: { email, name: `Navigation owner ${index}`, password },
      });
      expect(response.status()).toBe(200);
      people.push({ id: (await response.json()).user.id, email });
      if (index < 2)
        expect(
          (
            await context.request.post('/api/profile', {
              data: fields(`Navigation owner ${index}`),
            })
          ).status(),
        ).toBe(201);
    }
    const match = await db.match.create({
      data: { user1Id: people[0].id, user2Id: people[1].id, status: 'ACTIVE' },
    });
    return { db, contexts, people, match, close };
  } catch (error) {
    await close();
    throw error;
  }
}
async function login(page: Page, email: string, secret = password) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('protected paths and queries survive anonymous login and authenticated auth-page redirects', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 10);
  try {
    const { contexts, people, match } = owned;
    await contexts[0].clearCookies();
    const target = `/messages/${match.id}?view=history&from=login`;
    const page = await contexts[0].newPage();
    await page.goto(target);
    await expect(page).toHaveURL(/\/login\?/);
    expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(target);
    await login(page, people[0].email);
    await expect(page).toHaveURL(`${baseURL}${target}`);
    await expect(page.getByPlaceholder('Type a message...')).toBeVisible();
    expect((await contexts[0].request.get(`/api/matches/${match.id}`)).status()).toBe(200);
    const signedIn = await contexts[1].newPage();
    const settings = '/settings?section=privacy&from=auth';
    await signedIn.goto(`/login?callbackUrl=${encodeURIComponent(settings)}`);
    await expect(signedIn).toHaveURL(`${baseURL}${settings}`);
    await expect(signedIn.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  } finally {
    await owned.close();
  }
});

test('a genuinely missing profile completes onboarding before continuing to the safe requested destination', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 14);
  try {
    const { contexts, people, db } = owned;
    await contexts[2].clearCookies();
    const target = '/settings?section=location&from=onboarding';
    const page = await contexts[2].newPage();
    await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
    await login(page, people[2].email);
    await expect.poll(() => new URL(page.url()).pathname).toBe('/profile/setup');
    expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(target);
    await page.getByLabel('Name', { exact: true }).fill('Navigation owner 2');
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
    await expect(page).toHaveURL(`${baseURL}${target}`);
    expect(await db.profile.count({ where: { userId: people[2].id } })).toBe(1);
  } finally {
    await owned.close();
  }
});

test('profile lookup failure keeps a recoverable signed-in state without onboarding or resubmitting credentials', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 18);
  try {
    const { contexts, people } = owned;
    await contexts[0].clearCookies();
    const page = await contexts[0].newPage();
    let failProfile = true;
    let signIns = 0;
    let profileReads = 0;
    let onboardingReads = 0;
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/sign-in/email') signIns++;
      if (path === '/profile/setup') onboardingReads++;
    });
    await page.route('**/api/profile', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      profileReads++;
      if (failProfile)
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            requestId: 'synthetic-profile-failure',
          }),
        });
      else await route.continue();
    });
    const target = '/settings?section=privacy&from=recovery';
    await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
    await login(page, people[0].email, 'IncorrectPassword37!');
    await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible();
    expect(profileReads).toBe(0);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Retry profile check', exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
    expect(new URL(page.url()).searchParams.get('callbackUrl')).toBe(target);
    expect(onboardingReads).toBe(0);
    expect(signIns).toBe(2);
    failProfile = false;
    await page.getByRole('button', { name: 'Retry profile check', exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}${target}`);
    expect(signIns).toBe(2);
  } finally {
    await owned.close();
  }
});

test('external, protocol-relative and auth-loop callback destinations fall back safely', async ({
  browser,
  baseURL,
}) => {
  const owned = await fixture(browser, baseURL!, 22);
  try {
    const { contexts, people } = owned;
    const page = await contexts[1].newPage();
    let external = 0;
    await page.route('**/*evil.example.test**', async (route) => {
      if (new URL(route.request().url()).hostname === 'evil.example.test') {
        external++;
        await route.abort();
      } else await route.continue();
    });
    for (const target of [
      'https://evil.example.test/steal',
      '//evil.example.test/steal',
      '/\\evil.example.test/steal',
      'javascript:alert(1)',
      '/login?callbackUrl=/login',
      '/api/auth/sign-out',
    ]) {
      await page.goto(`/login?callbackUrl=${encodeURIComponent(target)}`);
      await expect(page).toHaveURL(`${baseURL}/discover`);
    }
    await contexts[1].clearCookies();
    await page.goto(`/login?callbackUrl=${encodeURIComponent('//evil.example.test/steal')}`);
    await login(page, people[1].email);
    await expect(page).toHaveURL(`${baseURL}/discover`);
    expect(external).toBe(0);
  } finally {
    await owned.close();
  }
});
