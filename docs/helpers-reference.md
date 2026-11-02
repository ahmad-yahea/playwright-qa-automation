# Helpers reference

All helpers live in `tests/helpers`. Import them with a relative path, e.g. `import { sessionOrSkip } from '../helpers/apiClient'`.

## `env.ts`: settings and fixtures

Reads the environment once. Nothing here has side effects.

| Export | Type | Meaning |
|---|---|---|
| `BASE_URL`, `API` | string | Website and API root (`API_URL`) |
| `mail` | `{ host, port, user, password, addressBase }` | Mailbox settings (`addressBase` defaults to `user`) |
| `mailConfigured` | boolean | True when the mailbox is complete |
| `VERIFY_EMAIL_SUBJECT` | string | Subject to look for in the verification email |
| `TEST_EMAIL_DOMAIN` | string | Domain for invented throwaway addresses (env, else mailbox domain, else `example.com`) |
| `emailDomainConfigured` | boolean | True when the domain came from `TEST_EMAIL_DOMAIN` or the mailbox, i.e. the application should accept it |
| `DISPOSABLE_EMAIL` | string | An address on a domain the application refuses as disposable |
| `TEST_EMAIL`, `TEST_PASSWORD` | string | Fallback customer |
| `ZONE_IN_ID`, `ZONE_IN_NAME` | string | The delivery-zone fixture |
| `IN_ZONE` | `{ lat, lng }` | A point inside the zone (also the default faked browser location) |
| `OUT_OF_ZONE` | `{ lat, lng }` | A point outside every zone |
| `SAMPLE_ADDRESS` | `{ addressLine, city, country, postalCode }` | Valid address for address tests |
| `UNKNOWN_UUID` | string | A well-formed id that matches nothing (for 404 tests) |
| `NO_ACCOUNT_REASON` | string | The skip message used when no customer is available |

## `apiClient.ts`: API sessions and calls

### Types

```ts
interface Account { email: string; password: string; source: 'fresh' | 'TEST_EMAIL' }
interface Session { ctx: APIRequestContext; csrf: string; account: Account }
```

A `Session` is a request context that already holds the auth cookies, plus the CSRF token needed by write calls.

### Functions

| Function | Returns | Use it to |
|---|---|---|
| `publicApi()` | `APIRequestContext` | Call the API **without** a login (base URL already set). Remember relative paths: `ctx.get('catalog/products')` |
| `sessionOrSkip()` | `Promise<Session>` | **Default entry point for any file that needs a customer.** Call it in `beforeAll`; skips the whole file with a reason when no customer is available |
| `sharedSession()` | `Promise<Session \| null>` | Same, but returns `null` instead of skipping. Cached for the whole run |
| `createFreshAccount()` | `Promise<Session>` | Real signup → verification email → verify → set password → login → phone, address, onboarding. Needs the mailbox. Used internally by `sharedSession()` |
| `ownSession(s)` | `Promise<Session>` | A **second** login for the same account, for tests that end the session (logout) and must not break the shared one |
| `writeHeaders(s, extra?)` | headers object | Headers for state-changing calls: `X-CSRF-Token`, a new `Idempotency-Key`, a new `x-session-id` |
| `clearCart(s)` | `APIResponse` | Empty the basket so a test starts from a known state |
| `addToCart(s, productId, quantity)` | `APIResponse` | Add a product; returns the raw response so the test asserts the status. `quantity` is `unknown` on purpose (to test bad values) |
| `allProducts()` | `Promise<any[]>` | The public product list (up to 200), for stock-aware tests |
| `errorText(res)` | `Promise<string>` | The error `message` as one string, for regex checks |
| `checkout(s, data)` | `APIResponse` | **The only way to call `POST checkout`.** Waits so calls are at least 13 s apart (the API allows about 5 per minute) |
| `checkoutBody(s, paymentSource)` | `Promise<object>` | A valid checkout body: first saved address, the zone id, current basket subtotal, the given payment source |

### Rules

1. Every write call sends `writeHeaders(s)`; without the CSRF token the API answers 403 (that is itself tested).
2. Every checkout call goes through `checkout()`. A direct `ctx.post('checkout')` will hit the throttle and flake the suite.
3. Do not log in inside a spec. Use `sessionOrSkip()`; login is rate limited.

## `browser.ts`: a logged-in browser

| Function | Returns | Use it to |
|---|---|---|
| `loggedInContext(browser, loc = IN_ZONE)` | `Promise<BrowserContext>` | Get a browser context that is already logged in and has a faked geolocation (so the "your location" pop-up does not cover the page). Remember to `await context.close()` |

How it works: the first call logs in **through the real login form** with the shared account, saves the storage state
(cookies + local storage), and reuses it for every later context. Copying only API cookies was not enough because the
front end keeps its own state. Pass a different `loc` to test other locations, e.g. `OUT_OF_ZONE`.

```ts
const context = await loggedInContext(browser);
const page = await context.newPage();
await page.goto('/browse');
// ...
await context.close();
```

## `mailbox.ts`: verification email

| Function | Returns | Meaning |
|---|---|---|
| `waitForVerifyLink(toAddress, timeoutMs = 90000)` | `Promise<string>` | Polls the IMAP inbox every 3 s for the newest email to `toAddress` with the verification subject and returns the `.../verify-email?token=...` link. Throws with a hint if nothing arrives |
| `tokenFromLink(link)` | string | The `token` query parameter of a link |

Works with any IMAP provider (library: `imapflow`). Quoted-printable line breaks and `=3D` are decoded before matching.

## `orders.ts`: orders and payment methods

| Export | Meaning |
|---|---|
| `PM` | Stripe **test payment-method ids**: `visa`, `declined`, `insufficient`, `expired`, `cvc`, `processing`, `threeDS`. No card number is ever typed |
| `ensureOrder(s)` | Places **one** order with `PM.visa` and remembers the result for the whole run. Returns `{ ok: true, id }` or `{ ok: false, reason }`. Every test that needs an order calls it, so a broken checkout makes them all skip with the same reason, and they start running by themselves once it works |
| `orderStatus(ctx, id)` | The order's status string (for example `PENDING`, `CONFIRMED`, `CANCELLED`, `REFUNDED`). Handles the `{ success, data }` wrapper |

## `testData.ts`: generated data

| Function | Returns | Meaning |
|---|---|---|
| `freshEmail()` | string | Unique `+alias` of the mailbox address, e.g. `qa+pw1730000000-ab12@example.com` |
| `testEmail(label)` | string | A throwaway address `qa.<label>.<timestamp>@<TEST_EMAIL_DOMAIN>` that is never delivered to. Use it instead of typing an address |
| `freshPassword()` | string | A password meeting the policy (upper, lower, digit, symbol, 8+) that is not a common one |
| `freshPhone()` | string | A made-up Irish mobile number in E.164 |
| `pickProduct(products, minStock = 5)` | product | An in-stock product from the public list, so tests never hard-code product ids |

## `knownBug.ts`: expected failures

`knownBug(ticket, reason)`: call it as the **first line** of a test that asserts correct behaviour which currently fails
because of an open defect. It adds a `known-bug` annotation and marks the test as an expected failure. See
[known-bugs.md](known-bugs.md) for the full lifecycle.

## Writing a new helper

Add it to the file that matches its job (or a new file here), document it with a short doc comment saying **what it does
and why**, and add a row to this page. Keep helpers free of assertions about the application; assertions belong in specs.
