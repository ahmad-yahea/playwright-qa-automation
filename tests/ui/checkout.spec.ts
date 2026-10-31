/**
 * CHECKOUT PAGE (browser, logged in).
 * Why: the customer must see the order summary and a way to pay before placing an order.
 * Placing the order and the confirmation page are covered by the journey (they need a working checkout).
 */
import { test, expect } from '@playwright/test';
import { addToCart, allProducts, clearCart, sessionOrSkip } from '../helpers/apiClient';
import { loggedInContext } from '../helpers/browser';
import { pickProduct } from '../helpers/testData';

test('shows the order summary, delivery and a Place order button', async ({ browser }) => {
  const s = await sessionOrSkip();
  await clearCart(s);
  await addToCart(s, pickProduct(await allProducts()).id, 1);
  const context = await loggedInContext(browser);
  const page = await context.newPage();
  await page.goto('/checkout/details');
  await expect(page.getByText('Order Summary')).toBeVisible();
  await expect(page.getByText(/delivery/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /place order/i })).toBeVisible();
  await context.close();
});
