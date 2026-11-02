/**
 * LOGIN FORM BEHAVIOUR (browser, API mocked).
 * Why: checks how the form itself behaves (masking, enter key, double click, network failure) without sending
 * real login attempts.
 */
import { test, expect, type Page } from '@playwright/test';
import { testEmail } from '../helpers/testData';

const unauthorised = { status: 401, contentType: 'application/json', body: '{"statusCode":401,"message":"Invalid email or password"}' };

async function fill(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(testEmail('nobody'));
  await page.locator('input[type=password]').fill('Not-a-real-password1');
}
const loginButton = (page: Page) => page.getByRole('button', { name: /^log in$/i }).last();

test('masks the password and the show/hide button toggles it', async ({ page }) => {
  await fill(page);
  const pw = page.locator('input[type=password], input[placeholder="••••••••"]').first();
  await expect(pw).toHaveAttribute('type', 'password');
  const toggle = page.getByRole('button', { name: /show password|hide password/i }).first();
  await toggle.click();
  await expect(pw).toHaveAttribute('type', 'text');
  await toggle.click();
  await expect(pw).toHaveAttribute('type', 'password');
});

test('the enter key submits the form once', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/auth/login', (r) => { calls++; return r.fulfill(unauthorised); });
  await fill(page);
  await page.locator('input[type=password]').press('Enter');
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  expect(calls).toBe(1);
});

test('a double click on Log in sends one request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/auth/login', async (r) => { calls++; await new Promise((res) => setTimeout(res, 800)); return r.fulfill(unauthorised); });
  await fill(page);
  await loginButton(page).evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  expect(calls).toBeLessThanOrEqual(1);
});

test('a network failure shows an error, not a silent hang', async ({ page }) => {
  await page.route('**/api/v1/auth/login', (r) => r.abort('failed'));
  await fill(page);
  await loginButton(page).click();
  await expect(page.getByText(/network|connection|try again|something went wrong/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/login/);
});
