/**
 * CATALOG API (public): categories, moods, products.
 * Why: the shop front reads these endpoints; bad data here shows to every customer.
 */
import { test, expect } from '@playwright/test';
import { allProducts, publicApi } from '../helpers/apiClient';
import { knownBug } from '../helpers/knownBug';

test('lists categories', { tag: '@smoke' }, async () => {
  const res = await (await publicApi()).get('catalog/categories');
  expect(res.status()).toBe(200);
});

test('serves real moods (no test data)', { tag: '@smoke' }, async () => {
  const moods = await (await (await publicApi()).get('catalog/moods')).json();
  expect(moods.length).toBeGreaterThan(0);
  for (const m of moods) expect(m.name).not.toMatch(/mood-2026|test/i);
});

test('lists only published products', { tag: '@smoke' }, async () => {
  const items = await allProducts();
  expect(items.length).toBeGreaterThan(0);
  expect(items.filter((p) => p.isPublished !== true).map((p) => p.name)).toEqual([]);
});

test('gives every product a price above zero and a stock number', async () => {
  const bad = (await allProducts()).filter((p) => !(p.price > 0) || typeof p.stock !== 'number');
  expect(bad.map((p) => p.name)).toEqual([]);
});

test('gives every product at least one image', async () => {
  knownBug('BUG-3', '3 products have no image (names omitted)');
  expect((await allProducts()).filter((p) => !p.imageUrls?.length).map((p) => p.name)).toEqual([]);
});
