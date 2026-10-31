/**
 * AUTH API: login, lockout and signup validation.
 * Why: auth is the first thing every customer touches; the backend must answer safely (same message for an
 * unknown email and a wrong password, lockout after repeated failures, nothing created for bad input).
 * Nothing here creates an account or locks a real one: lockout uses a throwaway email.
 */
import { test, expect } from '@playwright/test';
import { IN_ZONE, TEST_EMAIL } from '../helpers/env';
import { publicApi } from '../helpers/apiClient';

const login = async (email: string, password: string) => {
  const res = await (await publicApi()).post('auth/login', { data: { email, password } });
  return { status: res.status(), body: await res.json() };
};
const someEmail = TEST_EMAIL || 'qa.someone@gmail.com';

test.describe('login', () => {
  test('rejects a wrong password with 401 and a generic message', { tag: '@smoke' }, async () => {
    const r = await login(someEmail, 'Wrong1234x-not-the-password');
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid email or password');
  });

  test('gives an unknown email the same message as a wrong password (no account enumeration)', { tag: '@smoke' }, async () => {
    const r = await login(`qa.nobody.${Date.now()}@gmail.com`, 'Wrong1234x');
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid email or password');
  });

  test('locks the account on the 6th wrong attempt', async () => {
    // A throwaway email is used on purpose: no real account can be locked by this test.
    const email = `qa.lockout.${Date.now()}@gmail.com`;
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await login(email, 'Wrong1234x')).status);
    expect(codes).toEqual([401, 401, 401, 401, 401]);
    expect(JSON.stringify((await login(email, 'Wrong1234x')).body)).toMatch(/locked/i);
  });
});

test.describe('signup validation (every case is rejected, nothing is created)', () => {
  const post = async (data: object) => (await publicApi()).post('auth/signup', { data });
  const ok = { email: 'qa.validation.pw@gmail.com', name: 'QA Test', ...IN_ZONE };

  test('rejects an empty body with 400', { tag: '@smoke' }, async () => {
    expect((await post({})).status()).toBe(400);
  });
  test('rejects an invalid email with 400', { tag: '@smoke' }, async () => {
    expect((await post({ ...ok, email: 'not-an-email' })).status()).toBe(400);
  });
  test('rejects an empty name with 400', async () => {
    expect((await post({ ...ok, name: '' })).status()).toBe(400);
  });
  test('rejects a disposable email domain with 400', async () => {
    expect((await post({ ...ok, email: 'qa.test@example.com' })).status()).toBe(400);
  });
  test('refuses an out-of-zone location with 403', async () => {
    const res = await post({ ...ok, lat: 51.5, lng: -0.12 });
    // The signup limiter (429) counts attempts per IP and can answer before the zone check; not a failure of this test.
    test.skip(res.status() === 429, 'signup rate limit reached, run again later');
    expect(res.status()).toBe(403);
  });
});
