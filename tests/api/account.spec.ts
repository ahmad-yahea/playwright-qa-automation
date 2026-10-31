/**
 * ACCOUNT API (logged in): profile (PATCH /users/me) and delivery addresses.
 * Why: bad input must come back as a clear 4xx, never a 500, and unsafe data must never be saved.
 * Nothing permanent is created: if a call that should be rejected is wrongly accepted, the test deletes it.
 */
import { test, expect } from '@playwright/test';
import { SAMPLE_ADDRESS } from '../helpers/env';
import { Session, errorText, sessionOrSkip, writeHeaders } from '../helpers/apiClient';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });

const patchMe = (data: object) => s.ctx.patch('users/me', { data, headers: writeHeaders(s) });

test.describe('profile', () => {
  for (const phone of ['abc', '+3531']) {
    test(`rejects phone ${JSON.stringify(phone)}: must be E.164`, async () => {
      const res = await patchMe({ phone });
      expect(res.status()).toBe(400);
      expect(await errorText(res)).toMatch(/E\.164/);
    });
  }
  for (const field of ['role', 'email']) {
    test(`refuses to change "${field}" here (extra field is rejected)`, async () => {
      const res = await patchMe({ [field]: field === 'role' ? 'admin' : 'someone@gmail.com' });
      expect(res.status()).toBe(400);
      expect(await errorText(res)).toMatch(/should not exist/);
    });
  }
  // Needs a SECOND account that already owns the phone number; the suite creates one account per run only.
  test.skip('refuses a phone number already used by another account (BUG-8)', async () => {});
});

test.describe('addresses', () => {
  const body = (over: object) => ({ label: 'Work', ...SAMPLE_ADDRESS, ...over });
  const create = (over: object) => s.ctx.post('users/me/addresses', { data: body(over), headers: writeHeaders(s) });

  test('lists the saved addresses with coordinates', async () => {
    const list = await (await s.ctx.get('users/me/addresses')).json();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].latitude).toBeTruthy();
  });

  test('rejects a bad postal code with 400', async () => {
    const res = await create({ postalCode: '123' });
    expect(res.status()).toBe(400);
    expect(await errorText(res)).toMatch(/eircode|postal|postcode/i);
  });

  for (const label of ['<b>x</b>', 'a>b']) {
    test(`rejects an address label containing < or > (${JSON.stringify(label)})`, async () => {
      const res = await create({ label });
      const createdId = res.status() === 201 ? (await res.json()).id : null;
      try { expect(res.status()).toBe(400); }
      finally { if (createdId) await s.ctx.delete(`users/me/addresses/${createdId}`, { headers: writeHeaders(s) }); }
    });
  }
});
