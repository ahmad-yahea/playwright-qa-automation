/**
 * ZONE CHECK API: is an address inside a delivery zone?
 * Why: the zone decides whether we can deliver; a wrong "yes" means orders we cannot fulfil.
 */
import { test, expect } from '@playwright/test';
import { OUT_OF_ZONE, IN_ZONE, SAMPLE_ADDRESS, ZONE_IN_NAME } from '../helpers/env';
import { publicApi } from '../helpers/apiClient';

const check = async (qs: string) => {
  const res = await (await publicApi()).get('zones/check?' + qs);
  return { status: res.status(), body: await res.json() };
};

test('says coordinates inside the zone are serviceable', { tag: '@smoke' }, async () => {
  expect((await check(`lat=${IN_ZONE.lat}&lng=${IN_ZONE.lng}`)).body.isServiceable).toBe(true);
});

test('says coordinates outside the zone are not serviceable', { tag: '@smoke' }, async () => {
  expect((await check(`lat=${OUT_OF_ZONE.lat}&lng=${OUT_OF_ZONE.lng}`)).body.isServiceable).toBe(false);
});

test('refuses a point outside the zone even when the city name matches', async () => {
  expect((await check(`lat=${OUT_OF_ZONE.lat}&lng=${OUT_OF_ZONE.lng}&city=${encodeURIComponent(ZONE_IN_NAME)}&country=${encodeURIComponent(SAMPLE_ADDRESS.country)}`)).body.isServiceable).toBe(false);
});

// Without coordinates the API locates the typed place on the map and checks that point against the zone polygon.
// A name match ("matchedBy: city") must never decide serviceability.
test('never matches a zone by city name alone (no coordinates)', async () => {
  const inZone = (await check(`city=${encodeURIComponent(ZONE_IN_NAME)}&country=${encodeURIComponent(SAMPLE_ADDRESS.country)}`)).body;
  expect(inZone.matchedBy).not.toBe('city');
  expect((await check(`city=Atlantis&country=${encodeURIComponent(SAMPLE_ADDRESS.country)}`)).body.isServiceable).toBe(false);
  expect((await check('address=zzqqxx%20nowhere%20999')).body.isServiceable).toBe(false);
});

test('accepts the typed-address check used by the signup "Check" button', async () => {
  expect((await check(`address=${encodeURIComponent(SAMPLE_ADDRESS.addressLine + ', ' + SAMPLE_ADDRESS.city)}`)).status).toBe(200);
});
