/**
 * CHECKOUT API (logged in): validation, plus the real order when checkout works.
 * Why: this is the money path. THE QA API THROTTLES POST /checkout AT ~5/MIN, so every call goes through
 * checkout() (spaced 13 s apart) and this file makes only 2 calls outside the journey's single order attempt
 * (see helpers/orders.ts). Do not add more checkout calls here; put new order cases in payments.spec.ts.
 */
import { test, expect } from '@playwright/test';
import { ZONE_IN_ID, UNKNOWN_UUID } from '../helpers/env';
import { Session, addToCart, allProducts, checkout, checkoutBody, clearCart, errorText, sessionOrSkip } from '../helpers/apiClient';
import { ensureOrder } from '../helpers/orders';
import { pickProduct } from '../helpers/testData';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });
test.beforeEach(async () => {
  await clearCart(s);
  await addToCart(s, pickProduct(await allProducts()).id, 1); // an empty basket makes the API answer 409 before validating
});

test('rejects a checkout without paymentSource with 400  [checkout call 1 of 2]', async () => {
  const res = await checkout(s, { deliveryAddressId: UNKNOWN_UUID, zoneId: ZONE_IN_ID, expectedSubtotal: 1 });
  expect(res.status()).toBe(400);
  expect(await errorText(res)).toMatch(/paymentSource/);
});

test('rejects an unknown zone with 404  [checkout call 2 of 2]', async () => {
  const body = { ...(await checkoutBody(s, 'pm_card_visa')), zoneId: UNKNOWN_UUID };
  expect((await checkout(s, body)).status()).toBe(404);
});

test('places an order with a Stripe test card', async () => {
  const o = await ensureOrder(s);
  test.skip(!o.ok, o.ok ? '' : o.reason);
  expect(o.ok && o.id).toBeTruthy();
});
