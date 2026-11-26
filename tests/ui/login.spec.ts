import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/auth';

// These tests start LOGGED OUT, ignoring the saved session the other UI tests use.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login (UI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('a visitor starts logged out', async ({ page }) => {
    await expect(page.getByTestId('login-status')).toHaveText('Not logged in');
  });

  test('valid login shows the user name', async ({ page }) => {
    const username = requireEnv('TEST_USERNAME');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill(requireEnv('TEST_PASSWORD'));
    await page.getByTestId('login-btn').click();

    await expect(page.getByTestId('login-status')).toHaveText(`Logged in as ${username}`);
    await expect(page.getByTestId('logout-btn')).toBeVisible();
  });

  test('wrong password shows an error (negative test)', async ({ page }) => {
    await page.getByTestId('login-username').fill(requireEnv('TEST_USERNAME'));
    await page.getByTestId('login-password').fill('wrong-password');
    await page.getByTestId('login-btn').click();

    await expect(page.getByTestId('error')).toContainText('Invalid username or password');
    await expect(page.getByTestId('login-status')).toHaveText('Not logged in');
  });

  test('booking without logging in asks the user to log in', async ({ page }) => {
    await page.getByTestId('search-btn').click();
    await page.getByTestId('select-flight').first().click();
    await page.getByTestId('first-name').fill('Sam');
    await page.getByTestId('last-name').fill('Lee');
    await page.getByTestId('confirm-btn').click();

    await expect(page.getByTestId('error')).toContainText('Please log in first');
  });
});
