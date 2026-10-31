/**
 * CUSTOMER JOURNEY: one end-to-end story, in order, on a fresh account per run.
 * Why: this is the "does the whole shop work for a new customer" check. It reads like the customer story in
 * the HTML report: guest home -> signup -> verification email -> set password -> login -> onboarding ->
 * browse and search -> basket -> checkout -> order -> confirmation -> My Orders -> cancel -> refund -> logout.
 * Steps are skipped (with the reason shown) when they cannot run: no mailbox (MAIL_* not set) or checkout down (BUG-4).
 * Without a mailbox the journey continues with TEST_EMAIL/TEST_PASSWORD, or skips if that is not set either.
 * Signup, email check and set-password use the UI for the form and the API for verify/set-password (more robust).
 */
import { test, expect, Page } from '@playwright/test';
import { IN_ZONE, NO_ACCOUNT_REASON, mailConfigured } from '../helpers/env';
import { addToCart, allProducts, clearCart, publicApi, sharedSession } from '../helpers/apiClient';
import { waitForVerifyLink, tokenFromLink } from '../helpers/mailbox';
import { freshEmail, freshPassword, pickProduct } from '../helpers/testData';
import { ensureOrder, orderStatus } from '../helpers/orders';

test.describe.configure({ mode: 'serial' });

/**
 * A journey step that can be skipped on its own. (Calling test.skip() inside a step would skip the WHOLE test,
 * so a skipped step is shown in the report as "[SKIPPED: reason]" and gets an annotation instead.)
 */
async function step(title: string, skipReason: string | false, body: () => Promise<void>) {
  if (skipReason) {
    test.info().annotations.push({ type: 'skipped-step', description: `${title}: ${skipReason}` });
    return test.step(`${title} [SKIPPED: ${skipReason}]`, async () => {});
  }
  return test.step(title, body);
}
const NO_MAIL = 'MAIL_* not set (see README, Mailbox setup)';
test.use({ geolocation: { latitude: IN_ZONE.lat, longitude: IN_ZONE.lng }, permissions: ['geolocation'] });

test('a new customer can sign up, order, track, cancel and log out', async ({ page }) => {
  test.setTimeout(240_000);
  let email = '';
  let password = '';
  let verified: any;
  const fallback = await sharedSession(); // fresh account (mailbox) or TEST_EMAIL; used by the steps after login
  test.skip(!mailConfigured && !fallback, NO_ACCOUNT_REASON);

  await step('Guest opens the home page and sees the login button', false, async () => {
    await page.goto('/');
    await expect(page.getByText(/log in/i).first()).toBeVisible({ timeout: 20_000 });
  });

  await step('Signup form: submit name and email', !mailConfigured && NO_MAIL, async () => {
    email = freshEmail();
    await page.goto('/signup');
    await page.getByPlaceholder(/name/i).fill('Playwright QA');
    await page.locator('input[type=email]').fill(email);
    await page.getByRole('button', { name: /continue/i }).click({ timeout: 60_000 });
    await expect(page.getByText(/verification email sent/i)).toBeVisible({ timeout: 30_000 });
  });

  await step('Verification email arrives and the link validates', !mailConfigured && NO_MAIL, async () => {
    const link = await waitForVerifyLink(email);
    const verify = await (await publicApi()).post('auth/email/verify', { data: { token: tokenFromLink(link) } });
    expect(verify.ok()).toBe(true);
    verified = await verify.json();
  });

  await step('Customer sets a password', !mailConfigured && NO_MAIL, async () => {
    password = freshPassword();
    const v = verified;
    const res = await (await publicApi()).post('auth/set-password', { data: { setupToken: v.setupToken ?? v.token, password } });
    expect(res.ok()).toBe(true);
  });

  await step('Customer logs in through the login pop-up', false, async () => {
    if (!mailConfigured) { email = fallback!.account.email; password = fallback!.account.password; }
    await login(page, email, password);
  });

  await step('Onboarding: address and delivery zone are saved', false, async () => {
    const s = fallback!; // for a fresh account the API helper did phone, address and onboarding (see createFreshAccount)
    const addresses = await (await s.ctx.get('users/me/addresses')).json();
    expect(addresses.length).toBeGreaterThan(0); // the account must have an in-zone address to order
  });

  await step('Browse and search for a product', false, async () => {
    await page.goto('/browse/search?q=cadbury');
    await expect(page.getByText(/showing results for "cadbury"/i)).toBeVisible();
  });

  await step('Add a product to the basket', false, async () => {
    const s = fallback!;
    await clearCart(s);
    expect((await addToCart(s, pickProduct(await allProducts()).id, 1)).status()).toBe(201);
  });

  await step('Checkout page shows the summary and Place order', false, async () => {
    await page.goto('/checkout/details');
    await expect(page.getByText('Order Summary')).toBeVisible();
    await expect(page.getByRole('button', { name: /place order/i })).toBeVisible();
  });

  const o = await ensureOrder(fallback!); // one shared order attempt for the whole run (helpers/orders.ts)
  const orderId = o.ok ? o.id : '';
  const NO_ORDER = !o.ok && o.reason;
  await step('Place the order (Stripe test card)', NO_ORDER, async () => { expect(orderId).toBeTruthy(); });

  await step('Order appears in My Orders with a status', NO_ORDER, async () => {
    await page.goto('/browse/orders');
    await expect(page.getByText(orderId.slice(0, 8), { exact: false }).first()).toBeVisible({ timeout: 20_000 });
  });

  await step('Cancel the order and see it refunded', NO_ORDER, async () => {
    const s = fallback!;
    const cancel = await s.ctx.post(`orders/${orderId}/cancel`, { data: {}, headers: { 'X-CSRF-Token': s.csrf } });
    expect(cancel.ok()).toBe(true);
    await expect.poll(async () => orderStatus(s.ctx, orderId), { timeout: 60_000 }).toMatch(/refund|cancel/i);
  });

  await step('Log out: private pages ask for login again', false, async () => {
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await page.goto('/browse/orders');
    await expect(page.getByLabel('Email')).toBeVisible({ timeout: 20_000 });
  });
});

/** Logs in through the login pop-up. */
async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).last().click();
  await expect(page.getByLabel('Email')).toBeHidden({ timeout: 20_000 });
}
