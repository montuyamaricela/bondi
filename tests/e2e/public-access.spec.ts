import { expect, test } from '@playwright/test';

test('landing page exposes the product and signup call to action', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: /Find your perfect match/ }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /get started/i }).first()).toBeVisible();
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
