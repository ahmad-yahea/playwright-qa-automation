import { APIRequestContext, APIResponse, request, test } from '@playwright/test';
import { randomUUID } from 'crypto';
import { API, IN_ZONE, ZONE_IN_ID, NO_ACCOUNT_REASON, SAMPLE_ADDRESS, TEST_EMAIL, TEST_PASSWORD, mailConfigured } from './env';
import { waitForVerifyLink, tokenFromLink } from './mailbox';
import { freshEmail, freshPassword, freshPhone } from './testData';

/** A test customer: where the credentials came from tells you what the README means by "fresh" vs "fallback". */
export interface Account { email: string; password: string; source: 'fresh' | 'TEST_EMAIL' }

/** A logged-in API session: a request context holding the auth cookies, plus the CSRF token. */
export interface Session { ctx: APIRequestContext; csrf: string; account: Account }

/** A request context with the API base URL, for calls that need no login. */
export const publicApi = () => request.newContext({ baseURL: API + '/' });

/** Headers for state-changing calls: CSRF token, plus an idempotency key and session id for checkout. */
export function writeHeaders(s: Pick<Session, 'csrf'>, extra: Record<string, string> = {}) {
  return { 'X-CSRF-Token': s.csrf, 'Idempotency-Key': `checkout_${randomUUID()}`, 'x-session-id': randomUUID(), ...extra };
}

async function login(account: Account): Promise<Session> {
  const ctx = await publicApi();
  const res = await ctx.post('auth/login', { data: { email: account.email, password: account.password } });
  if (!res.ok()) throw new Error(`Login failed with ${res.status()} for the ${account.source} account (429 = login rate limit, wait a few minutes)`);
  return { ctx, csrf: (await res.json()).csrfToken, account };
}

/**
 * Creates a brand-new customer through the real signup flow: signup -> verification email (read from the
 * mailbox) -> verify token -> set password -> login -> phone, address and onboarding done.
 * Needs the MAIL_* settings. Accounts are not deleted afterwards (see README, "Test data").
 */
export async function createFreshAccount(): Promise<Session> {
  const email = freshEmail();
  const password = freshPassword();
  const anon = await publicApi();
  const signup = await anon.post('auth/signup', { data: { email, name: 'Playwright QA', ...IN_ZONE } });
  if (!signup.ok()) throw new Error(`Signup failed with ${signup.status()}: ${await signup.text()}`);
  const token = tokenFromLink(await waitForVerifyLink(email));
  const verify = await anon.post('auth/email/verify', { data: { token } });
  if (!verify.ok()) throw new Error(`Email verify failed with ${verify.status()}: ${await verify.text()}`);
  const v = await verify.json();
  const setupToken = v.setupToken ?? v.token ?? token;
  const setPw = await anon.post('auth/set-password', { data: { setupToken, password } });
  if (!setPw.ok()) throw new Error(`Set password failed with ${setPw.status()}: ${await setPw.text()}`);
  const s = await login({ email, password, source: 'fresh' });
  await s.ctx.patch('users/me', { data: { phone: freshPhone() }, headers: writeHeaders(s) });
  await s.ctx.post('users/me/addresses', {
    data: { label: 'Home', ...SAMPLE_ADDRESS },
    headers: writeHeaders(s),
  });
  await s.ctx.post('users/me/onboarding/complete', { data: {}, headers: writeHeaders(s) });
  return s;
}

let shared: Promise<Session | null> | undefined;

/**
 * The one logged-in session reused by all API tests in a run (login is rate-limited, so we log in once).
 * Order of preference: a fresh account (if the mailbox is configured), else TEST_EMAIL/TEST_PASSWORD, else null.
 */
export function sharedSession(): Promise<Session | null> {
  return (shared ??= (async () => {
    if (mailConfigured) {
      try { return await createFreshAccount(); }
      catch (e) { console.warn(`Fresh account could not be created (${(e as Error).message}); trying TEST_EMAIL`); }
    }
    if (TEST_EMAIL && TEST_PASSWORD) return login({ email: TEST_EMAIL, password: TEST_PASSWORD, source: 'TEST_EMAIL' });
    return null;
  })());
}

/** Use in beforeAll of any file that needs a customer: returns the session, or skips the whole file with a reason. */
export async function sessionOrSkip(): Promise<Session> {
  const s = await sharedSession();
  test.skip(!s, NO_ACCOUNT_REASON);
  return s as Session;
}

/** A second login for the same account, for tests that would otherwise end the shared session (e.g. logout). */
export async function ownSession(s: Session): Promise<Session> { return login(s.account); }

/** Empties the basket so every test starts from a known state. */
export const clearCart = (s: Session) => s.ctx.delete('cart', { headers: writeHeaders(s) });

/** Adds a product to the basket; returns the raw response so tests can assert on the status. */
export const addToCart = (s: Session, productId: string, quantity: unknown) =>
  s.ctx.post('cart/items', { data: { productId, quantity }, headers: writeHeaders(s) });

/** The public product list (up to 200), for tests that need stock levels. */
export async function allProducts(): Promise<any[]> {
  const body = await (await (await publicApi()).get('catalog/products?limit=200')).json();
  return body.items ?? body;
}

/** The message field of an error response as one string, for simple regex checks. */
export const errorText = async (res: APIResponse) => JSON.stringify((await res.json()).message);

let lastCheckout = 0;
/**
 * POST /checkout, but never faster than one call every 13 seconds: the QA API throttles checkout at
 * about 5 per minute (429). Every checkout call in the suite must go through here.
 */
export async function checkout(s: Session, data: object): Promise<APIResponse> {
  const wait = lastCheckout + 13_000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCheckout = Date.now();
  return s.ctx.post('checkout', { data, headers: writeHeaders(s) });
}

/** Builds a valid checkout body for the current basket (real subtotal, saved address, in-zone). */
export async function checkoutBody(s: Session, paymentSource: string) {
  const addresses = await (await s.ctx.get('users/me/addresses')).json();
  const { totalAmount } = await (await s.ctx.get('cart')).json();
  return { deliveryAddressId: addresses[0].id, zoneId: ZONE_IN_ID, paymentSource, expectedSubtotal: totalAmount };
}
