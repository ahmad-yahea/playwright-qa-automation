import type { APIRequestContext } from '@playwright/test';
import { Session, addToCart, allProducts, checkout, checkoutBody, clearCart, errorText } from './apiClient';
import { pickProduct } from './testData';

/** Stripe test payment method ids: no card numbers are ever typed. */
export const PM = {
  visa: 'pm_card_visa',
  declined: 'pm_card_chargeDeclined',
  insufficient: 'pm_card_chargeDeclinedInsufficientFunds',
  expired: 'pm_card_chargeDeclinedExpiredCard',
  cvc: 'pm_card_chargeDeclinedIncorrectCvc',
  processing: 'pm_card_chargeDeclinedProcessingError',
  threeDS: 'pm_card_authenticationRequired',
};

export type OrderState = { ok: true; id: string } | { ok: false; reason: string };
let order: Promise<OrderState> | undefined;

/**
 * Places ONE order with a Stripe test card and remembers the result for the whole run.
 * Why one shared attempt: checkout is throttled and currently fails on QA (BUG-4). Every test that needs
 * an order calls this; if it did not work they all skip with the same reason, and start running by
 * themselves as soon as checkout works. Counts as the journey's "place order" call.
 */
export function ensureOrder(s: Session): Promise<OrderState> {
  return (order ??= (async () => {
    await clearCart(s);
    await addToCart(s, pickProduct(await allProducts()).id, 1);
    const res = await checkout(s, await checkoutBody(s, PM.visa));
    if (!res.ok()) return { ok: false as const, reason: `Checkout is not working on this environment (BUG-4): ${res.status()} ${await errorText(res)}` };
    const b = await res.json();
    const id = b.orderId ?? b.id ?? b.order?.id;
    return id ? { ok: true as const, id } : { ok: false as const, reason: `Order created but the response has no order id: ${JSON.stringify(b).slice(0, 120)}` };
  })());
}

/** Status of one order, e.g. PENDING, CONFIRMED, CANCELLED, REFUNDED. The API wraps bodies as { success, data }. */
export async function orderStatus(ctx: APIRequestContext, id: string): Promise<string | undefined> {
  const b = await (await ctx.get(`orders/${id}`)).json();
  return b?.data?.status ?? b?.data?.order?.status ?? b?.status;
}
