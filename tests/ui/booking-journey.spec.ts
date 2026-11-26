import { test, expect } from '@playwright/test';
import { requireEnv } from '../helpers/auth';

test.describe('Flight search and booking (UI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('home page loads', async ({ page }) => {
    await expect(page).toHaveTitle('Flight Booking Demo');
    await expect(page.getByRole('heading', { name: 'Flight Booking Demo' })).toBeVisible();
  });

  test('the saved session means the user is already logged in', async ({ page }) => {
    await expect(page.getByTestId('login-status')).toHaveText(`Logged in as ${requireEnv('TEST_USERNAME')}`);
  });

  test('searching MEL to SYD shows two flights', async ({ page }) => {
    await page.getByTestId('origin').selectOption('MEL');
    await page.getByTestId('destination').selectOption('SYD');
    await page.getByTestId('search-btn').click();

    await expect(page.getByTestId('flight-card')).toHaveCount(2);
    await expect(page.getByTestId('flight-number').first()).toHaveText('QF401');
  });

  test('a route with no flights shows a friendly message', async ({ page }) => {
    await page.getByTestId('origin').selectOption('PER');
    await page.getByTestId('destination').selectOption('BNE');
    await page.getByTestId('search-btn').click();

    await expect(page.getByTestId('no-results')).toBeVisible();
  });

  test('same origin and destination shows a validation error', async ({ page }) => {
    await page.getByTestId('origin').selectOption('MEL');
    await page.getByTestId('destination').selectOption('MEL');
    await page.getByTestId('search-btn').click();

    await expect(page.getByTestId('error')).toContainText('must be different');
  });

  test('full journey: search, select, enter details, confirm', async ({ page }) => {
    await page.getByTestId('search-btn').click();               // defaults: MEL to SYD
    await page.getByTestId('select-flight').first().click();

    await expect(page.getByTestId('booking-panel')).toBeVisible();
    await page.getByTestId('first-name').fill('Sam');
    await page.getByTestId('last-name').fill('Lee');
    await page.getByTestId('confirm-btn').click();

    await expect(page.getByTestId('confirmation')).toContainText(/Booking confirmed: [A-Z0-9]{6}/);
  });

  test('booking without a last name shows an error', async ({ page }) => {
    await page.getByTestId('search-btn').click();
    await page.getByTestId('select-flight').first().click();
    await page.getByTestId('first-name').fill('Sam');
    await page.getByTestId('confirm-btn').click();

    await expect(page.getByTestId('error')).toContainText('lastName');
    await expect(page.getByTestId('confirmation')).toBeHidden();
  });
});
