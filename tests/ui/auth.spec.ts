/**
 * AUTH PAGES (browser): login pop-up and signup form.
 * Why: first customer touch point; the form must work and show a clear error. The browser location is faked as
 * the delivery zone so the signup "we're not in your area" gate does not stop the test.
 */
import { test, expect } from '@playwright/test';
import { IN_ZONE, TEST_EMAIL } from '../helpers/env';

test.describe('login', () => {
  test('shows the email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.locator('input[type=password]')).toBeVisible();
  });

  test('shows an error for a wrong password and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(TEST_EMAIL || 'qa.someone@gmail.com');
    await page.locator('input[type=password]').fill('Wrong1234x-not-the-password');
    await page.getByRole('button', { name: /log in|sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('signup form', () => {
  test.use({ geolocation: { latitude: IN_ZONE.lat, longitude: IN_ZONE.lng }, permissions: ['geolocation'] });

  test('blocks an empty email', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: /continue/i }).click({ timeout: 60_000 }); // the form can take a while to render
    const email = page.locator('input[type=email]');
    await expect(email).toBeVisible();
    expect(await email.evaluate((el: HTMLInputElement) => el.validationMessage)).not.toBe('');
  });
});
