/**
 * PAYMENT MATRIX (API, logged in): Stripe test payment method ids, no card numbers typed.
 * Why: declines and 3DS are where money bugs hide (double charge, order stuck pending, basket not kept).
 * All cases need a working checkout: they skip with the reason while checkout is down (BUG-4) and run
 * by themselves once it works. Every call goes through checkout() (spaced 13 s), so the full matrix takes ~2 min.
 */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { Session, addToCart, allProducts, checkout, checkoutBody, clearCart, errorText, sessionOrSkip, writeHeaders } from '../helpers/apiClient';
import { PM, ensureOrder } from '../helpers/orders';
import { pickProduct } from '../helpers/testData';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });
test.beforeEach(async () => {
  const o = await ensureOrder(s);
  test.skip(!o.ok, o.ok ? '' : o.reason);
  await clearCart(s);
  await addToCart(s, pickProduct(await allProducts()).id, 1);
});

const declines: [string, string][] = [
  ['generic decline', PM.declined], ['insufficient funds', PM.insufficient],
  ['expired card', PM.expired], ['wrong CVC', PM.cvc], ['processing error', PM.processing],
];
for (const [name, pm] of declines) {
  test(`refuses a ${name} with a clear 4xx and keeps the basket`, async () => {
    const res = await checkout(s, await checkoutBody(s, pm));
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    expect(await errorText(res)).toBeTruthy();
    expect((await (await s.ctx.get('cart')).json()).items).toHaveLength(1);
  });
}

test('does not confirm a 3DS card until the customer authenticates', async () => {
  const res = await checkout(s, await checkoutBody(s, PM.threeDS));
  const text = await res.text();
  expect(text).not.toMatch(/"status":"CONFIRMED"/i);
});

test('creates only one order when the same idempotency key is sent twice', async () => {
  // Spacing call first (checkout is throttled). It places an order and empties the basket, so refill it after.
  await checkout(s, await checkoutBody(s, PM.visa));
  await addToCart(s, pickProduct(await allProducts()).id, 1);
  const data = await checkoutBody(s, PM.visa);
  const headers = writeHeaders(s, { 'Idempotency-Key': `checkout_${randomUUID()}` });
  // Two posts with the same key at the same time, like a double click.
  const [a, b] = await Promise.all([s.ctx.post('checkout', { data, headers }), s.ctx.post('checkout', { data, headers })]);
  const ok = [a, b].filter((r) => r.ok());
  expect(ok.length).toBeGreaterThan(0);
  const ids = new Set(await Promise.all(ok.map(async (r) => (await r.json()).orderId)));
  expect(ids.size).toBe(1); // a replay returns the same order
  for (const r of [a, b].filter((r) => !r.ok())) expect(r.status()).toBe(409); // or is refused as "already being processed"
});
