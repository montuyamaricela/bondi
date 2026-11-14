import { expect, test } from '@playwright/test';

test('landing page exposes the product and signup call to action', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /Find your perfect match/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
});

test('landing matching claims and keyboard actions agree with the available flow', async ({
  page,
}) => {
  await page.goto('/');
  const approach = page.getByRole('link', { name: 'How we do it', exact: true });
  await expect(approach).toHaveAttribute('href', '#how-it-works');
  for (let index = 0; index < 12; index++) {
    if (await approach.evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press('Tab');
  }
  await expect(approach).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/#how-it-works$/);
  const destination = page.locator('#how-it-works');
  await expect(destination).toBeFocused();
  await expect
    .poll(() => destination.evaluate((element) => element.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(80);

  const matching = page.locator('#labs');
  await expect(matching).toContainText('shared interests, hobbies, and relationship preferences');
  await expect(matching).not.toContainText(
    /learns|interactions|the more you use|better your matches/i,
  );
  for (const href of await page
    .locator('a[href^="#"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!))) {
    await expect(page.locator(href)).toHaveCount(1);
  }
  const signup = page.getByRole('link', { name: 'Get started', exact: true });
  await expect(signup.locator('button')).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(signup).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/signup$/);
  await expect(
    page.getByRole('heading', { name: 'Create your account', exact: true }),
  ).toBeVisible();
  const protectedProfile = await page.request.get('/api/profile');
  expect(protectedProfile.status()).toBe(401);
  expect(await protectedProfile.json()).toMatchObject({ error: 'Unauthorized' });
});

test('login form provides labeled credentials', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in|log in/i })).toBeVisible();
});

test('anonymous discovery redirects to login on the same origin', async ({ page, baseURL }) => {
  await page.goto('/discover');
  await expect(page).toHaveURL(/\/login\?callbackUrl=(%2F|\/)discover/);
  expect(new URL(page.url()).origin).toBe(baseURL);
});

test("anonymous messages cannot read another user's conversations", async ({ request }) => {
  const response = await request.get('/api/messages?matchId=synthetic-nonexistent-match');
  expect(response.status()).toBe(401);
  expect(await response.json()).toMatchObject({ error: 'Unauthorized' });
});
