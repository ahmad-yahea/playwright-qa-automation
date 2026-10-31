/**
 * BROWSE, SEARCH AND HEADER (browser, logged in).
 * Why: shows what a customer sees when searching and what the header says about delivery.
 */
import { test, expect } from '@playwright/test';
import { loggedInContext } from '../helpers/browser';
import { OUT_OF_ZONE, ZONE_IN_NAME } from '../helpers/env';

test('keeps the header search box and the results in sync', async ({ browser }) => {
  const context = await loggedInContext(browser);
  const page = await context.newPage();
  await page.goto('/browse/search?q=cadbury');
  const box = page.locator('input[placeholder^="Search for products"]:visible');
  await expect(box).toHaveValue('cadbury');
  await box.fill('heinz');
  await box.press('Enter');
  await expect(page).toHaveURL(/q=heinz/);
  await expect(page.getByText(/showing results for "heinz"/i)).toBeVisible();
  await expect(box).toHaveValue('heinz');
  await context.close();
});

for (const [name, loc] of [['inside the zone', undefined], ['outside the zone', OUT_OF_ZONE]] as const) {
  test(`shows the zone of the saved address in the header when the browser location is ${name}`, async ({ browser }) => {
    const context = await loggedInContext(browser, loc);
    const page = await context.newPage();
    await page.goto('/browse');
    await expect(page.getByText('Same-day delivery').first()).toBeVisible();
    await expect(page.locator('header').first()).toContainText(new RegExp(ZONE_IN_NAME, 'i'));
    await context.close();
  });
}
