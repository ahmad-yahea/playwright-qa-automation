/**
 * SIGNUP FORM VALIDATION (browser, API mocked).
 * Why: checks what the form does with bad, odd and hostile input without creating real accounts.
 * The browser location is faked as a point inside the delivery zone so the "we're not in your area" gate does
 * not stop the test.
 */
import { test, expect, type Page } from '@playwright/test';
import { IN_ZONE } from '../helpers/env';

test.describe('signup form', () => {
  test.use({ geolocation: { latitude: IN_ZONE.lat, longitude: IN_ZONE.lng }, permissions: ['geolocation'] });

  const ok = { status: 201, contentType: 'application/json', body: '{"message":"Verification email sent. Please check your inbox."}' };
  const nameBox = (page: Page) => page.getByPlaceholder('John Doe');
  const emailBox = (page: Page) => page.locator('input[type=email]');
  const next = (page: Page) => page.getByRole('button', { name: /continue/i });

  async function open(page: Page) {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible({ timeout: 60_000 });
  }

  test('rejects a malformed email without sending anything', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/v1/auth/signup', (r) => { calls++; return r.fulfill(ok); });
    await open(page);
    await nameBox(page).fill('QA Tester');
    await emailBox(page).fill('not-an-email');
    await next(page).click();
    await expect(page.getByText(/verification email sent/i)).toBeHidden();
    expect(calls).toBe(0);
  });

  test('a double click on Continue sends one signup', async ({ page }) => {
    let calls = 0;
    await page.route('**/api/v1/auth/signup', async (r) => { calls++; await new Promise((res) => setTimeout(res, 800)); return r.fulfill(ok); });
    await open(page);
    await nameBox(page).fill('QA Tester');
    await emailBox(page).fill('qa.nobody@example.com');
    await next(page).evaluate((el: HTMLButtonElement) => { el.click(); el.click(); });
    await expect(page.getByText(/verification email sent/i)).toBeVisible();
    expect(calls).toBe(1);
  });

  test('accepts an Irish name with fadas and sends it unchanged', async ({ page }) => {
    let sent: { name?: string } = {};
    await page.route('**/api/v1/auth/signup', (r) => { sent = r.request().postDataJSON(); return r.fulfill(ok); });
    await open(page);
    await nameBox(page).fill('Siobhán Ní Bhriain');
    await emailBox(page).fill('qa.nobody@example.com');
    await next(page).click();
    await expect(page.getByText(/verification email sent/i)).toBeVisible();
    expect(sent.name).toBe('Siobhán Ní Bhriain');
  });

  test('a script tag in the name never runs', async ({ page }) => {
    let dialogs = 0;
    page.on('dialog', async (d) => { dialogs++; await d.dismiss(); });
    await page.route('**/api/v1/auth/signup', (r) => r.fulfill(ok));
    await open(page);
    await nameBox(page).fill('<img src=x onerror=alert(1)>');
    await emailBox(page).fill('qa.nobody@example.com');
    await next(page).click();
    await page.waitForTimeout(1500);
    expect(dialogs).toBe(0);
  });
});

test.describe('signup location check', () => {
  test.use({ permissions: [] });

  test('a denied location permission does not leave the page hanging', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByText(/create your account|not in your area|enter your address|we deliver/i).first()).toBeVisible({ timeout: 45_000 });
  });
});
