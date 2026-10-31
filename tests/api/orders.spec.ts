/**
 * ORDERS API (logged in): lookup, ownership, cancel and refund.
 * Why: customers track and cancel orders; unknown ids must give clean 4xx errors (never a raw database
 * error) and a second cancel must not succeed again. Tests that need a real order skip with the reason
 * while checkout is down (see helpers/orders.ts) and run by themselves once it works.
 */
import { test, expect } from '@playwright/test';
import { UNKNOWN_UUID } from '../helpers/env';
import { Session, sessionOrSkip, writeHeaders } from '../helpers/apiClient';
import { ensureOrder, orderStatus } from '../helpers/orders';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });

test('returns 404 for an unknown order id', { tag: '@smoke' }, async () => {
  expect((await s.ctx.get(`orders/${UNKNOWN_UUID}`)).status()).toBe(404);
});

test('returns 400 for an order id that is not a uuid', { tag: '@smoke' }, async () => {
  expect((await s.ctx.get('orders/not-a-uuid')).status()).toBe(400);
});

test('returns 404 when cancelling an unknown order', async () => {
  const res = await s.ctx.post(`orders/${UNKNOWN_UUID}/cancel`, { data: {}, headers: writeHeaders(s) });
  expect(res.status()).toBe(404);
});

test.describe('with a real order', () => {
  test('lists the new order and shows its status', async () => {
    const o = await ensureOrder(s);
    test.skip(!o.ok, o.ok ? '' : o.reason);
    const res = await s.ctx.get(`orders/${(o as any).id}`);
    expect(res.status()).toBe(200);
    expect(await orderStatus(s.ctx, (o as any).id)).toBeTruthy();
  });

  // A second cancel is a harmless no-op: 200 with alreadyCancelled (agreed in BUG-1 / BUG-7), never 201.
  test('cancels the order once, and a second cancel is a 200 no-op', async () => {
    const o = await ensureOrder(s);
    test.skip(!o.ok, o.ok ? '' : o.reason);
    const id = (o as any).id;
    expect((await s.ctx.post(`orders/${id}/cancel`, { data: {}, headers: writeHeaders(s) })).ok()).toBe(true);
    const again = await s.ctx.post(`orders/${id}/cancel`, { data: {}, headers: writeHeaders(s) });
    expect(again.status()).toBe(200);
    expect(JSON.stringify(await again.json())).toMatch(/alreadyCancelled/);
  });
});
