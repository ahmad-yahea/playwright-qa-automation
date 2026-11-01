/**
 * PAGE HEALTH (browser). Why: a quick check that the shop opens with no script errors and no missing files.
 */
import { test, expect } from '@playwright/test';

test('home page loads without script errors', { tag: '@smoke' }, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toEqual([]);
});

test('home page has no missing files (404)', { tag: '@smoke' }, async ({ page }) => {
  const missing: string[] = [];
  page.on('response', (r) => { if (r.status() === 404 && !r.url().includes('favicon')) missing.push(`${r.url()} -> 404`); });
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(missing).toEqual([]);
});
