import { Browser, BrowserContext, expect, test } from '@playwright/test';
import { sharedSession } from './apiClient';
import { IN_ZONE, NO_ACCOUNT_REASON } from './env';

type Loc = { lat: number; lng: number };
let storage: Promise<Awaited<ReturnType<BrowserContext['storageState']>>> | undefined;

/** Logs in through the real login pop-up once per run and keeps the browser state (cookies + local storage). */
async function loginState(browser: Browser) {
  const s = await sharedSession();
  test.skip(!s, NO_ACCOUNT_REASON);
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(s!.account.email);
  await page.locator('input[type=password]').fill(s!.account.password);
  await page.getByRole('button', { name: /^log in$/i }).last().click();
  await expect(page.getByLabel('Email')).toBeHidden({ timeout: 20_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

/**
 * A browser context that is already logged in. Why: the shop sends logged-out visitors to a login pop-up
 * on most pages, and copying only API cookies was not enough (the front end keeps its own state), so we log
 * in through the UI once and reuse that state. The browser location is faked (inside the zone by default) so the
 * "Your location" pop-up does not cover the page.
 */
export async function loggedInContext(browser: Browser, loc: Loc = IN_ZONE): Promise<BrowserContext> {
  const state = await (storage ??= loginState(browser));
  return browser.newContext({ storageState: state, geolocation: { latitude: loc.lat, longitude: loc.lng }, permissions: ['geolocation'] });
}
