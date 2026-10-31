/**
 * SESSION AND SECURITY API: CSRF protection, logout, removed endpoints.
 * Why: cookies are SameSite=None, so every write call must demand the X-CSRF-Token header; and a logged-out
 * session must really be logged out.
 */
import { test, expect } from '@playwright/test';
import { Session, allProducts, ownSession, publicApi, sessionOrSkip } from '../helpers/apiClient';
import { pickProduct } from '../helpers/testData';

test('has no public guest-checkout endpoint (404)', { tag: '@smoke' }, async () => {
  expect((await (await publicApi()).post('checkout/guest', { data: {} })).status()).toBe(404);
});

test('refuses a protected call without a login (401)', { tag: '@smoke' }, async () => {
  expect((await (await publicApi()).get('users/me/addresses')).status()).toBe(401);
});

test.describe('logged in', () => {
  let s: Session;
  test.beforeAll(async () => { s = await sessionOrSkip(); });

  test('refuses to log out without the CSRF token (403)', async () => {
    const own = await ownSession(s); // own session, so the shared one stays logged in
    expect((await own.ctx.post('auth/logout')).status()).toBe(403);
  });

  test('refuses to add to the basket without the CSRF token (403)', async () => {
    const res = await s.ctx.post('cart/items', { data: { productId: pickProduct(await allProducts()).id, quantity: 1 } });
    expect(res.status()).toBe(403);
  });

  test('refuses to clear the basket without the CSRF token (403)', async () => {
    expect((await s.ctx.delete('cart')).status()).toBe(403);
  });

  test('ends the session on logout: the old cookies no longer work', async () => {
    const own = await ownSession(s);
    expect((await own.ctx.post('auth/logout', { headers: { 'X-CSRF-Token': own.csrf } })).ok()).toBe(true);
    expect((await own.ctx.get('users/me/addresses')).status()).toBe(401);
  });
});
