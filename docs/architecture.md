# Architecture

## In one picture

```
                         .env (local)  /  GitHub secrets + variables (CI)
                                          │
                                  playwright.config.ts
                       (1 Chromium project, 1 worker, reporters, retries)
                                          │
        ┌─────────────────────────────────┼──────────────────────────────────┐
        │                                 │                                  │
   tests/api/*                       tests/ui/*                      tests/journey/*
 (backend, no browser)           (browser, some mocked)         (serial end-to-end story)
        │                                 │                                  │
        └──────────────┬──────────────────┴──────────────┬───────────────────┘
                       │          tests/helpers/*        │
   env ── apiClient ── browser ── mailbox ── orders ── testData ── knownBug
     │        │           │          │
     │        │           │          └─ IMAP mailbox (verification email)
     │        │           └─ real login pop-up once, reused storage state
     │        └─ signup → verify → set password → login (fresh account)
     └─ URLs, zone fixtures, mailbox settings, sample data
                                          │
                                  application under test
                              (website + API, test environment)
```

## Layers

| Layer | Folder | Job |
|---|---|---|
| Config | `playwright.config.ts`, `.env` | Where to point, how to run, how to report |
| Helpers | `tests/helpers` | Everything reusable: sessions, throttling, mailbox, data, known-bug marker |
| Specs | `tests/api`, `tests/ui`, `tests/journey` | The checks themselves, grouped by feature and kind |
| Docs | `docs` | This documentation |
| Pipeline | `.github/workflows/qa.yml` | Smoke on pull requests, full run nightly, manual run |

There is deliberately **no page-object layer**: pages are small and the tests read as a story. Add structure only when a
page is used by many tests.

## How a run flows

1. `playwright.config.ts` loads `.env` (locally) or uses the CI environment, then starts **one worker**.
2. The first test that needs a customer calls `sessionOrSkip()` (API) or `loggedInContext()` (browser).
3. `sharedSession()` decides **who the customer is**, once per run, in this order:
   1. **Fresh account**, if the mailbox settings (`MAIL_*`) are complete: real signup → verification email read over IMAP → verify → set password → login → phone, address, onboarding.
   2. **Fallback account** from `TEST_EMAIL` / `TEST_PASSWORD`.
   3. **None**: the tests that need a customer skip, with the reason shown.
4. The session (cookies + CSRF token) is **reused by every test** in the run, because login and signup are rate limited.
5. `loggedInContext()` logs in through the real login form once, saves the browser storage state, and hands each UI test a new context that starts logged in.
6. Anything that places an order goes through `ensureOrder()` (one shared order attempt) and `checkout()` (spaced calls).
7. Reports: terminal list locally; in CI also GitHub annotations, `results.json` and an HTML report.

## Design decisions (and why)

| Decision | Why |
|---|---|
| One worker, tests share one account | The API throttles login, signup and checkout per IP; parallel workers would only produce 429s |
| Login once, reuse | Same reason, and it keeps runs fast |
| Fresh customer per run | No shared state between runs, and signup/verification is itself tested |
| Fallback account | Lets a run work without a mailbox (CI, a colleague's laptop) |
| `knownBug()` instead of `test.skip` | The test keeps guarding the correct behaviour and turns the run red the day the bug is fixed |
| Tests skip with a reason, never fail, when a prerequisite is missing | A missing mailbox or a broken checkout should read as "not run", not as a regression |
| Stripe **test payment-method ids**, never card numbers | No card data in code, and every decline path is available |
| Mock login/signup in the form-behaviour tests | They check the form, not the server, and must not create accounts or send real login attempts |
| Journey is one serial test with `test.step` | The report reads like the customer story and shows exactly which step broke |
| Tests prefer behaviour (status codes, URLs, what is visible) over exact wording | Copy changes should not break the suite |
| One browser (Chromium) | Fast and readable; add projects in the config for Firefox, WebKit or mobile |

## Shared state to be aware of

- **The basket** belongs to the shared account. Tests that use it call `clearCart(s)` first. Do not rely on its contents across tests.
- **The order**: `ensureOrder()` places at most one order per run and every dependent test reads that result.
- **The last checkout time** is module-level state in `apiClient.ts`; it is what spaces checkout calls 13 seconds apart.
- **The storage state** of the browser login is cached in `browser.ts` for the run.

Because of this, **do not turn on parallel workers** without redesigning those four things.

## What the suite never does

- It never types a card number (Stripe test payment-method ids only).
- It never deletes the accounts it creates (account clean-up is not automated; see [security-and-data.md](security-and-data.md)).
- It never sends real credentials from the mocked UI tests.
- It never needs a personal account.
