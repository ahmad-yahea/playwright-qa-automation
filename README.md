# Playwright QA Automation (API + UI + end-to-end journey)

A regression suite for an e-commerce site, written in TypeScript with Playwright Test. It checks what a
customer does, front to back: guest home, signup, email verification, login, onboarding, search, basket, checkout,
payment, order tracking, cancel/refund and logout, plus the negative and edge cases behind each step.
It doubles as the **CI gate**: a smoke run on every pull request and push, the full suite every night.

**What this project demonstrates**

- API and UI tests in one suite, with a serial end-to-end **customer journey** whose steps show up one by one in the report
- A fresh customer per run: real signup, verification link read from an IMAP mailbox, no shared test accounts
- `knownBug()` helper: open defects stay as green "expected failures" and turn the run red the day they are fixed
- Rate-limit aware helpers (throttled checkout, login done once and reused), CSRF-aware write helper
- Configuration entirely from `.env` / CI variables, secrets only in GitHub Secrets
- GitHub Actions: smoke on PRs, full nightly, manual run, HTML report + job summary

> **The application under test is not included.** The suite targets a private web shop, so the URLs, zone ids and some
> UI texts are placeholders: set `BASE_URL`, `API_URL` and the other values in `.env` to point it at your own
> environment and adapt the selectors/texts as needed. It is shared as a worked example of the structure and techniques.

Why it is simple: one browser (Chromium), one config, plain TypeScript, no page-object layer. Add structure only when needed.

## What it covers

| Area | Where | What is checked |
|---|---|---|
| **Customer journey** | `tests/journey` | One serial end-to-end story on a fresh account (steps are shown one by one in the report) |
| Auth | `tests/api/auth`, `tests/ui/auth` | Login errors, no account enumeration, lockout, signup validation, out-of-zone refusal |
| Account | `tests/api/account` | Phone (E.164), forbidden fields, address validation (Eircode, unsafe labels) |
| Catalog | `tests/api/catalog` | Categories, real moods, published products, prices, images |
| Zones | `tests/api/zones` | Serviceable / not serviceable, city fallback, typed-address check |
| Cart | `tests/api/cart` | Add, quantity rules, unknown / out-of-stock / over-stock products |
| Checkout and payments | `tests/api/checkout`, `tests/api/payments`, `tests/ui/checkout` | Validation, order with a Stripe test card, declines, 3DS, double submit |
| Orders | `tests/api/orders` | Lookup, unknown ids, cancel once / not twice, refund |
| Session and security | `tests/api/session-security`, `tests/ui/access-control` | CSRF, logout, removed endpoints, admin area closed to customers |
| Browse and search | `tests/ui/browse-search` | Search box and results in sync, delivery zone in the header |

`docs/test-cases.md` lists every test by feature with its type and status.

## Quick start

```bash
npm install
npx playwright install chromium
cp .env.example .env       # then edit (see "Configuration")
npm run test:smoke         # quick, API only
npm test                   # everything
npm run test:api           # backend only
npm run test:ui            # browser + journey
npx playwright test tests/api/cart.spec.ts      # one file
npx playwright test -g "quantity"                # by test name
npx playwright test --headed tests/journey       # watch the browser
npm run report                                   # open the HTML report of the last run
```

## Configuration

Everything environment-specific lives in `.env` (git-ignored); `.env.example` documents every key.
In CI the same names come from repository **secrets** (`MAIL_*`, `TEST_*`) and **variables** (the rest).

| Key | Purpose |
|---|---|
| `BASE_URL`, `API_URL` | The site and API under test (required) |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_ADDRESS_BASE` | IMAP mailbox for verification emails; enables fresh-account runs |
| `VERIFY_EMAIL_SUBJECT` | Subject of the verification email |
| `TEST_EMAIL`, `TEST_PASSWORD` | Optional pre-verified customer when no mailbox is set |
| `ZONE_IN_ID`, `ZONE_IN_NAME`, `ZONE_IN_LAT/LNG`, `ZONE_OUT_LAT/LNG` | Delivery-zone fixtures (a zone id, a point inside and a point outside) |
| `SAMPLE_ADDRESS_LINE`, `SAMPLE_CITY`, `SAMPLE_COUNTRY`, `SAMPLE_POSTAL_CODE` | Sample address for address tests |

Nothing set? Public and validation tests still run; tests that need a customer skip with the reason shown.

## Accounts and mailbox

The suite never needs a personal account. Each run creates its **own fresh customer** through the real signup, which
needs one thing: **a mailbox it can read** to get the verification link.

### Mailbox setup per provider
- **Company mailbox (recommended):** create one shared mailbox such as `qa@example.com`, enable IMAP, and use its host/port (ask whoever runs your email) with an app password. Nobody's personal account is involved.
- **Gmail:** `MAIL_HOST=imap.gmail.com`, `MAIL_PORT=993`, 2-Step Verification on, then Google account -> Security -> App passwords, use that as `MAIL_PASSWORD`. `+alias` addresses land in the same inbox.
- **Outlook / Microsoft 365:** `MAIL_HOST=outlook.office365.com`, `MAIL_PORT=993`; IMAP with an app password (if your tenant blocks basic auth, use a different provider).
- Public throwaway inbox services will not work: the app refuses disposable email domains at signup.

**Suggested improvement:** ask the backend team for a QA-only way to get the verification token (a test endpoint, or an
allow-listed test email domain). Then the mailbox is not needed at all and signup becomes fully self-contained.

## CI (GitHub Actions)

`.github/workflows/qa.yml`:
- pull request and push to `main`: **smoke** (about 1 minute)
- every night (03:00 UTC): **full** suite
- manual run (Actions tab -> QA -> Run workflow): choose smoke or full

Each run installs Node 22 and Chromium, runs the tests, uploads the `playwright-report` artifact for 14 days (download it and
open `index.html`) and writes pass/fail counts to the job summary. In CI there is one retry (a test that passes on retry
is reported as "flaky") and `test.only` is forbidden.

**Secrets to add** (repo Settings -> Secrets and variables -> Actions): `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`,
`MAIL_PASSWORD`, `MAIL_ADDRESS_BASE`; optional `TEST_EMAIL`, `TEST_PASSWORD`. Repo **variables**: `BASE_URL`, `API_URL` (required; without them the workflow only prints a notice) plus the optional `ZONE_*` and `VERIFY_EMAIL_SUBJECT` values.
Without the mailbox secrets the pipeline still runs, but logged-in tests and the journey's signup steps are skipped.

## Add a test

1. Put it in the file for its feature (`tests/api/<feature>.spec.ts`, `tests/ui/<page>.spec.ts`), or add a step to the journey.
2. Name it by behaviour: `rejects quantity 0 with 400`, not a ticket number.
3. Start a new file with the comment block (what, why). Template:

```ts
/** FEATURE API: what it covers. Why: what goes wrong for a customer if this breaks. */
import { test, expect } from '@playwright/test';
import { Session, sessionOrSkip } from '../helpers/apiClient';

let s: Session;
test.beforeAll(async () => { s = await sessionOrSkip(); });   // skips the file if no account is available

test('does something correctly', { tag: '@smoke' }, async () => {   // @smoke only for quick, stable API checks
  const res = await s.ctx.get('cart');
  expect(res.status()).toBe(200);
});
```
4. Write calls through the helpers: `sessionOrSkip()` (logged-in API session), `publicApi()` (no login), `loggedInContext(browser)` (logged-in browser), `checkout()` (the only way to call checkout: it spaces calls).
5. Add a row to `docs/test-cases.md`.

## Known bugs: `knownBug()`

When a test fails because of an open bug, keep asserting the **correct** behaviour and add one line at the top of the test:

```ts
knownBug('BUG-6', 'address label with < or > is accepted (201)');
```

While the bug is open the test is an **expected failure**: the run stays green and the ticket id shows in the report
(annotation `known-bug`). When the bug is fixed the test starts passing, Playwright reports **"Expected to fail, but passed"**
and the run goes **red**. That is the signal: delete the `knownBug()` line and the test becomes a normal regression test.

## Test data

- Each run creates one new customer (a `+alias` of the mailbox) through signup. Accounts are **not deleted**, so the test database grows by one customer per run (nightly = one a day). Ask the backend team for a cleanup job if that becomes a problem.
- Tests that must create data and cannot avoid it delete it afterwards (for example an address that was wrongly accepted).
- No card numbers are ever typed: payments use Stripe test payment method ids (`pm_card_visa`, `pm_card_chargeDeclined`, ...).

## Checkout throttle

The API throttles `POST /checkout` at about 5 per minute and the whole suite shares one IP. Every checkout call goes through
`checkout()` in `tests/helpers/apiClient.ts`, which waits 13 seconds between calls. Outside the journey's single order attempt
(`ensureOrder`, shared by the whole run) `tests/api/checkout.spec.ts` makes 2 calls. While checkout fails on QA (BUG-4) the tests that need an
order skip with that reason; once it works they run by themselves (the payment matrix then adds about 2 minutes).

## Troubleshooting

- **429 on login or signup:** rate limit, many runs from one IP. Wait a few minutes. Login is done once per run and reused.
- **429 on checkout:** you added a checkout call that bypasses `checkout()`.
- **403 on a write call:** the `X-CSRF-Token` header is missing; use `writeHeaders(session)`.
- **Verification email did not arrive:** check `MAIL_*`, that IMAP is enabled, and the spam folder; the email subject must match `VERIFY_EMAIL_SUBJECT`.
- **"Expected to fail, but passed":** a known bug was fixed; remove its `knownBug()` line.
- **Everything skipped:** no `MAIL_*` and no `TEST_EMAIL`/`TEST_PASSWORD` set.
