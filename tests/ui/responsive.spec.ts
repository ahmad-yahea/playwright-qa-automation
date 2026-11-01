/**
 * RESPONSIVE (browser). Why: fails if any page scrolls sideways at the widths we design for.
 */
import { test, expect, type Page } from '@playwright/test';
import { loggedInContext } from '../helpers/browser';

const WIDTHS = [360, 390, 768, 1024, 1280, 1536, 1920, 2560];
const PUBLIC_PAGES = ['/', '/login', '/signup', '/forgot-password', '/contact', '/terms', '/privacy-policy'];
const STOREFRONT_PAGES = ['/browse', '/browse/categories', '/browse/search?q=a', '/browse/basket', '/browse/account', '/browse/orders'];

async function expectNoOverflow(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path, { waitUntil: 'networkidle' });
  const { overflow, culprits } = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const culprits = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 1 && getComputedStyle(el).position !== 'fixed';
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)}`);
    return { overflow, culprits };
  });
  expect(overflow, `${path} at ${width}px scrolls sideways by ${overflow}px: ${culprits.join(', ')}`).toBeLessThanOrEqual(1);
}

test.describe('responsive: public pages', () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} fits every width`, async ({ page }) => {
      for (const width of WIDTHS) await expectNoOverflow(page, path, width);
    });
  }
});

test.describe('responsive: storefront pages (logged in)', () => {
  for (const path of STOREFRONT_PAGES) {
    test(`${path} fits every width`, async ({ browser }) => {
      const context = await loggedInContext(browser);
      const page = await context.newPage();
      for (const width of WIDTHS) await expectNoOverflow(page, path, width);
      await context.close();
    });
  }
});
