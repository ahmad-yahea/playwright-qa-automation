# Test suites: file by file

For every spec: what it protects, what it needs, what it creates, and how it behaves when it cannot run.
For the test-by-test matrix see [test-cases.md](test-cases.md).

**Legend.** *Needs customer* = uses the shared account (fresh or fallback), skips with a reason if none.
*Needs checkout* = skips with a reason while checkout does not work. *Smoke* = contains `@smoke` tests.

## `tests/journey`

### `customer-journey.spec.ts`: the whole story
One **serial** test, shown as steps in the report: guest opens home → signup form → verification email arrives and the link
validates → set password → login through the pop-up → onboarding data present → browse and search → add to basket →
checkout page shows summary and "Place order" → place the order (Stripe test card) → order appears in My Orders →
cancel and see it refunded → log out (private pages ask for login again).

- **Needs:** a mailbox for the signup steps; a customer (fresh or fallback) for the rest; checkout for the order steps.
- **Creates:** one fresh customer and one order (cancelled and refunded by the test itself).
- **When it cannot run:** a step that cannot run is **not failed**. It is shown as `[SKIPPED: reason]` and a `skipped-step` annotation is added, while the other steps still run.
- **Timeout:** 240 s.

## `tests/api`: backend, no browser

| File | Protects | Needs | Creates / side effects |
|---|---|---|---|
| `auth.spec.ts` (smoke) | Login answers safely: 401 with a generic message, same message for unknown email (no account enumeration), account lock after repeated failures; signup validation (empty body, invalid email, empty name, disposable domain, out-of-zone location) | nothing | Nothing. The lockout test uses a throwaway email, never a real account |
| `account.spec.ts` | Profile and addresses: phone must be E.164, forbidden fields cannot be changed, a bad postal code is rejected, unsafe address labels (`<`, `>`) are rejected | customer | Nothing permanent. If a call that should be rejected is wrongly accepted, the test deletes what it created |
| `catalog.spec.ts` (smoke) | Public data the shop front reads: categories, real moods (no test data), only published products, price above zero and a stock number, at least one image per product | nothing | Nothing |
| `zones.spec.ts` (smoke) | Delivery zone decisions: inside is serviceable, outside is not, a matching city name is not enough, no match by city alone, the typed-address check used by signup | nothing | Nothing |
| `cart.spec.ts` (smoke) | A visitor never sees a customer basket; adding works and the total matches; bad quantities are 400; unknown product 404; out of stock 409; more than stock 409 | customer (except the visitor test) | Uses and clears the shared basket |
| `checkout.spec.ts` | Checkout validation (missing payment source 400, unknown zone 404) and a real order with a Stripe test card | customer; the order test needs checkout | Two checkout calls plus the shared order. **Do not add more checkout calls** (throttle) |
| `payments.spec.ts` | Payment matrix with Stripe test payment-method ids: each decline type gives a clear 4xx and keeps the basket; a 3DS card is not confirmed until the customer authenticates; the same idempotency key creates one order | customer, checkout | Declined attempts create no confirmed order; each call is spaced by `checkout()` |
| `orders.spec.ts` (smoke) | Unknown order id 404, non-UUID id 400, cancelling an unknown order 404; with a real order: it is listed with a status, a cancel works once and a second cancel is a 200 no-op | unknown-id tests: customer; the rest: checkout | Cancels the shared order |
| `session-security.spec.ts` (smoke) | No public guest-checkout endpoint; protected calls without login are 401; write calls without the CSRF token are 403 (logout, basket add, basket clear); logout really ends the session | customer for the logged-in group | Uses `ownSession()` so the shared session survives the logout test |

## `tests/ui`: browser

| File | Protects | Needs | Notes |
|---|---|---|---|
| `auth.spec.ts` | Login form shows email and password; a wrong password shows an error and stays on `/login`; signup blocks an empty email | nothing | Browser location faked inside the zone so the "not in your area" gate does not interfere |
| `login-behaviour.spec.ts` | Password masked and the show/hide button toggles; enter key submits once; double click sends one request; a network failure shows an error, not a hang | nothing | **API mocked** with `page.route`: no real login attempts |
| `signup-validation.spec.ts` | Malformed email sends nothing; double click on Continue sends one signup; names with accents accepted and sent unchanged; a script tag in the name never runs; a denied location permission does not hang | nothing | **API mocked**: no accounts created |
| `access-control.spec.ts` | A logged-out visitor is asked to log in on a private page; a customer does not see the staff dashboard at `/admin` | customer for the second test | |
| `browse-search.spec.ts` | Header search box and results stay in sync; the header shows the zone of the saved address for an inside and an outside browser location | customer | |
| `checkout.spec.ts` | The checkout page shows the order summary, delivery and a "Place order" button | customer | Placing the order itself is covered by the journey |
| `responsive.spec.ts` | No page scrolls sideways at 360, 390, 768, 1024, 1280, 1536, 1920 and 2560 px | storefront group needs a customer | Reports up to 3 offending elements per failure |
| `health.spec.ts` (smoke) | Home page has no script errors and no missing files (404) | nothing | |

## Counts and tags

- Run `npx playwright test --list` for the current number of tests.
- `@smoke` = quick, stable checks run on every pull request (about a minute).
- Use `--grep-invert @smoke` to run everything except smoke.
