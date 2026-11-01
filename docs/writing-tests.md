# Writing tests

## Where a test goes

| It checks | Put it in |
|---|---|
| A backend endpoint | `tests/api/<feature>.spec.ts` |
| What a customer sees or does in the browser | `tests/ui/<page>.spec.ts` |
| A step of the end-to-end story | `tests/journey/customer-journey.spec.ts` |
| A reusable action (login, data, a call) | `tests/helpers/` (and a row in [helpers-reference.md](helpers-reference.md)) |

## Conventions

1. **Start every file with a comment block**: `FEATURE (kind): what it covers. Why: what goes wrong for a customer if this breaks.`
2. **Name tests by behaviour**: `rejects quantity 0 with 400`, not a ticket number or `test1`.
3. **One idea per test.** If the title needs "and" twice, split it.
4. **No hard-coded ids, hosts or credentials.** Use `env.ts`, `pickProduct()` and the fresh-data helpers.
5. **Prefer behaviour over wording**: status codes, URLs and visibility before exact text. Where wording matters (a safe error message), match it loosely with a regex.
6. **Clean up after yourself** only when the test creates data it did not mean to (for example an address that was wrongly accepted).
7. **Skip with a reason, never fail, when a prerequisite is missing** (`sessionOrSkip()`, `test.skip(!o.ok, reason)`).
8. Add the test to [test-cases.md](test-cases.md). Tag with `@smoke` only quick, stable checks.
9. **Do not add checkout calls** except through `checkout()`; the suite already uses its allowance.

## Templates

### API test (logged in)

```ts
/** CART API (logged in): quantities. Why: the basket feeds checkout; bad quantities must be refused with a clear 4xx. */
import { test, expect } from '@playwright/test';
import { Session, addToCart, allProducts, clearCart, sessionOrSkip } from '../helpers/apiClient';
import { pickProduct } from '../helpers/testData';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });     // skips the file if no customer is available
test.beforeEach(async () => { await clearCart(s); });

test('rejects quantity 0 with 400', { tag: '@smoke' }, async () => {
  const p = pickProduct(await allProducts());
  expect((await addToCart(s, p.id, 0)).status()).toBe(400);
});
```

### API test (no login)

```ts
import { publicApi } from '../helpers/apiClient';

test('lists categories', { tag: '@smoke' }, async () => {
  const res = await (await publicApi()).get('catalog/categories');
  expect(res.ok()).toBe(true);
});
```

### Browser test (logged in)

```ts
import { loggedInContext } from '../helpers/browser';

test('shows the order summary', async ({ browser }) => {
  const context = await loggedInContext(browser);        // already logged in, location faked inside the zone
  const page = await context.newPage();
  await page.goto('/checkout/details');
  await expect(page.getByText('Order Summary')).toBeVisible();
  await context.close();
});
```

### Browser test with the API mocked (no data created, no real requests)

```ts
test('a double click sends one request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/auth/login', async (r) => {
    calls++;
    await new Promise((res) => setTimeout(res, 800));
    return r.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Invalid email or password"}' });
  });
  await page.goto('/login');
  // ...fill the form, click twice via evaluate so the clicks are truly simultaneous...
  expect(calls).toBeLessThanOrEqual(1);
});
```

Use mocking when the test is about the **form**, not the server, and a real call would create an account or send a real
login attempt.

### Journey step

Add a `step('title', skipReason | false, async () => { ... })` call to the serial test. A step with a skip reason is shown
as `[SKIPPED: reason]` and does not fail the story.

## Handling an open bug

Assert the correct behaviour, add `knownBug('<id>', '<reason>')` as the first line, and add a row in
[known-bugs.md](known-bugs.md). When the run goes red with "Expected to fail, but passed", delete the line.

## Rate limits to respect

| Endpoint | Limit seen | What the suite does |
|---|---|---|
| Login | a few failed attempts lock an account; many attempts from one IP return 429 | Log in once per run and reuse; the lockout test uses a throwaway email |
| Signup | 429 after bursts from one IP | One fresh account per run |
| Checkout | about 5 per minute | `checkout()` spaces calls 13 s apart |

## Anti-patterns

- `page.waitForTimeout(5000)` instead of waiting for a condition (`expect(...).toBeVisible()`, `expect.poll`).
- Logging in inside a spec.
- Calling `ctx.post('checkout')` directly.
- Asserting something that depends on the data being a particular product or order.
- Leaving `test.only` in (CI fails the build on it).
- Weakening an assertion so a known bug "passes".
- Putting real credentials, hosts, ids or customer data in code, docs or commit messages.

## Before you push

```bash
npx playwright test --list        # compiles every spec and lists the tests
npm run test:smoke                # quick check against your environment
git diff --stat                   # no .env, no reports, no results.json
```
