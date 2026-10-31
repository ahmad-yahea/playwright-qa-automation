/**
 * CART API (logged in): adding, quantities, stock rules.
 * Why: the basket feeds checkout; bad quantities and stock edge cases must be refused with a clear 4xx.
 */
import { test, expect } from '@playwright/test';
import { UNKNOWN_UUID } from '../helpers/env';
import { Session, addToCart, allProducts, clearCart, errorText, publicApi, sessionOrSkip } from '../helpers/apiClient';
import { pickProduct } from '../helpers/testData';

test('shows a visitor without a login an empty basket, never a customer cart', { tag: '@smoke' }, async () => {
  const res = await (await publicApi()).get('cart');
  expect(res.status()).toBe(200);
  expect((await res.json()).items).toEqual([]);
});

test.describe('logged in', () => {
  let s: Session;
  let productId: string;
  test.beforeAll(async () => { s = await sessionOrSkip(); productId = pickProduct(await allProducts()).id; });
  test.beforeEach(async () => { await clearCart(s); });

  test('adds a product (201) and the total matches the price', { tag: '@smoke' }, async () => {
    expect((await addToCart(s, productId, 1)).status()).toBe(201);
    const cart = await (await s.ctx.get('cart')).json();
    expect(cart.items).toHaveLength(1);
    expect(cart.totalAmount).toBe(cart.items[0].price);
  });

  for (const q of [0, -1, 'two', 1.5, 99999]) {
    test(`rejects quantity ${JSON.stringify(q)} with 400`, { tag: '@smoke' }, async () => {
      expect((await addToCart(s, productId, q)).status()).toBe(400);
    });
  }

  test('rejects an unknown product with 404', async () => {
    expect((await addToCart(s, UNKNOWN_UUID, 1)).status()).toBe(404);
  });

  test('rejects an out-of-stock product with 409', async () => {
    const oos = (await allProducts()).find((p) => p.stock === 0);
    test.skip(!oos, 'no out-of-stock product on this environment right now');
    const res = await addToCart(s, oos.id, 1);
    expect(res.status()).toBe(409);
    expect(await errorText(res)).toMatch(/out of stock/i);
  });

  test('rejects more than the stock with 409 "Only N of ... left in stock"', async () => {
    const p = (await allProducts()).find((x) => x.stock >= 1 && x.stock <= 500);
    const res = await addToCart(s, p.id, p.stock + 1);
    expect(res.status()).toBe(409);
    expect(await errorText(res)).toMatch(/Only \d+ of .* left in stock/);
  });
});
