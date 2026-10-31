/**
 * ACCESS CONTROL (browser): who can open which page.
 * Why: a customer must never see the staff dashboard, and a visitor must be asked to log in for private pages.
 */
import { test, expect } from '@playwright/test';
import { loggedInContext } from '../helpers/browser';

test('asks a logged-out visitor to log in on a private page', async ({ page }) => {
  await page.goto('/browse/orders');
  await expect(page.getByLabel('Email')).toBeVisible({ timeout: 20_000 });
});

test('does not show the Operations Dashboard to a customer opening /admin', async ({ browser }) => {
  const context = await loggedInContext(browser);
  const page = await context.newPage();
  await page.goto('/admin');
  // /admin redirects client-side to /admin/dashboard and renders after that, so wait for the page to settle
  // before asserting "absent"; without this wait the test would pass too early.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  try { await expect(page.getByText('Operations Dashboard')).toHaveCount(0); } finally { await context.close(); }
});
