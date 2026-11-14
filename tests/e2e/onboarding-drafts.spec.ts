import { assertTestDatabase } from '../helpers/test-database';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test } from '@playwright/test';

test('onboarding drafts survive same-account reloads but never logout or account changes', async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  assertTestDatabase();
  const db = new PrismaClient();
  const context = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.244' },
  });
  const otherContext = await browser.newContext({
    extraHTTPHeaders: { 'x-forwarded-for': '192.0.2.245' },
  });
  const emails = ['alice', 'bob'].map(
    (name) => `bondi-e2e-${randomUUID()}-draft-${name}@example.test`,
  );
  const password = 'SyntheticDraft24!';
  const avatar =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
  try {
    for (const [index, owner] of [context, otherContext].entries()) {
      const response = await owner.request.post('/api/auth/sign-up/email', {
        headers: { Origin: baseURL! },
        data: {
          email: emails[index],
          password,
          name: index === 0 ? 'Synthetic Alice' : 'Synthetic Bob',
        },
      });
      expect(response.status()).toBe(200);
    }
    const page = await context.newPage();
    await page.goto('/profile/setup');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Alice');
    const privateName = 'Private synthetic name for Alice';
    const privateBio = 'A synthetic private Alice draft that must never cross accounts.';
    await page.getByLabel('Name', { exact: true }).fill(privateName);
    await page.getByLabel('Age', { exact: true }).fill('29');
    await page.getByLabel('Bio').fill(privateBio);
    await expect
      .poll(() =>
        page.evaluate(
          (marker) => Object.values(localStorage).some((value) => value.includes(marker)),
          privateBio,
        ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        ({ bio, avatar }) => {
          for (const key of Object.keys(localStorage)) {
            try {
              const stored = JSON.parse(localStorage.getItem(key)!);
              if (stored?.data?.bio === bio) {
                stored.data.profileImage = avatar;
                localStorage.setItem(key, JSON.stringify(stored));
                return true;
              }
            } catch {
              /* Other application storage is unrelated. */
            }
          }
          return false;
        },
        { bio: privateBio, avatar },
      ),
    ).toBe(true);
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(privateName);
    await expect(page.getByLabel('Bio')).toHaveValue(privateBio);
    await expect(page.getByRole('img', { name: 'Profile', exact: true })).toHaveAttribute(
      'src',
      avatar,
    );
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Synthetic Alice' }).click();
    await page.getByRole('menuitem', { name: 'Logout', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(
      await page.evaluate(
        (marker) => Object.values(localStorage).some((value) => value.includes(marker)),
        privateBio,
      ),
    ).toBe(false);
    await page.getByLabel('Email', { exact: true }).fill(emails[1]);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/profile\/setup$/);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Bob');
    await expect(page.getByLabel('Age', { exact: true })).toHaveValue('18');
    await expect(page.getByLabel('Bio')).toHaveValue('');
    await expect(page.getByRole('img', { name: 'Profile', exact: true })).toHaveCount(0);
    const bobBio = 'A second private synthetic draft belonging only to Bob.';
    await page.getByLabel('Bio').fill(bobBio);
    await page.reload();
    await expect(page.getByLabel('Bio')).toHaveValue(bobBio);
    // Preserve the ten-minute expiration contract, using only this synthetic draft record.
    expect(
      await page.evaluate((marker) => {
        for (const key of Object.keys(localStorage)) {
          try {
            const stored = JSON.parse(localStorage.getItem(key)!);
            if (stored?.data?.bio === marker) {
              stored.timestamp = Date.now() - 11 * 60_000;
              localStorage.setItem(key, JSON.stringify(stored));
              return true;
            }
          } catch {
            /* Ignore unrelated storage. */
          }
        }
        return false;
      }, bobBio),
    ).toBe(true);
    await page.reload();
    await expect(page.getByLabel('Bio')).toHaveValue('');
    await page.getByLabel('Bio').fill(bobBio);
    // Another tab signs in; returning here refreshes the still-mounted form's identity.
    await context.clearCookies();
    const switchingTab = await context.newPage();
    await switchingTab.goto('/login');
    await switchingTab.getByLabel('Email', { exact: true }).fill(emails[0]);
    await switchingTab.getByLabel('Password', { exact: true }).fill(password);
    await switchingTab.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(switchingTab).toHaveURL(/\/profile\/setup$/);
    await page.bringToFront();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Alice');
    await expect(page.getByLabel('Bio')).toHaveValue('');
    await expect(page.getByRole('img', { name: 'Profile', exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(
        (marker) => Object.values(localStorage).some((value) => value.includes(marker)),
        bobBio,
      ),
    ).toBe(false);
    await page.evaluate(
      ({ avatar, privateBio }) =>
        localStorage.setItem(
          'profile-setup-form',
          JSON.stringify({
            data: { name: 'Unowned legacy draft', bio: privateBio, profileImage: avatar },
            timestamp: Date.now(),
          }),
        ),
      { avatar, privateBio },
    );
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Synthetic Alice');
    await expect(page.getByLabel('Bio')).toHaveValue('');
    await expect(page.getByRole('img', { name: 'Profile', exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('profile-setup-form'))).toBe(null);
  } finally {
    await Promise.all([context.close(), otherContext.close()]);
    try {
      await db.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await db.$disconnect();
    }
  }
});
