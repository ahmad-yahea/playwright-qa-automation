# Configuration

All environment-specific values live in **`.env`** (git-ignored, copy from `.env.example`). In CI the same names come from
GitHub **secrets** (credentials) and **variables** (everything else). Nothing is hard-coded in the tests except harmless
sample values and the Stripe test payment-method ids. An empty value counts as "not set".

## Environment variables

### Target (required)

| Variable | Default | Secret? | Meaning |
|---|---|---|---|
| `BASE_URL` | `https://shop.example.com` | no | The website under test. Also the Playwright `baseURL`, so tests use relative paths like `/login` |
| `API_URL` | `https://api.shop.example.com/api/v1` | no | The backend API root, with trailing path. API tests call relative paths such as `auth/login` |

### Mailbox for the verification email (optional, enables "fresh account per run")

| Variable | Default | Secret? | Meaning |
|---|---|---|---|
| `MAIL_HOST` | empty | no | IMAP server, e.g. `imap.gmail.com` |
| `MAIL_PORT` | `993` | no | IMAP port. `993` means TLS |
| `MAIL_USER` | empty | **yes** | Mailbox login |
| `MAIL_PASSWORD` | empty | **yes** | Mailbox **app password** (never the account password) |
| `MAIL_ADDRESS_BASE` | `MAIL_USER` | no | Address to which `+alias` is added: `qa@example.com` gives `qa+pw1730000000-ab12@example.com` |
| `VERIFY_EMAIL_SUBJECT` | `Verify your email` | no | Subject of the verification email the application sends; used to find it |

The mailbox is "configured" only when `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD` and an address base are all set
(`mailConfigured` in `tests/helpers/env.ts`).

### Fallback customer (optional)

| Variable | Secret? | Meaning |
|---|---|---|
| `TEST_EMAIL` | **yes** | A pre-verified customer with an address and onboarding done. Used when there is no mailbox, or the fresh account could not be created |
| `TEST_PASSWORD` | **yes** | Its password |

### Delivery-zone fixtures (describe the environment under test)

| Variable | Default | Meaning |
|---|---|---|
| `ZONE_IN_ID` | placeholder UUID | Id of a delivery zone, used to build valid checkout bodies |
| `ZONE_IN_NAME` | `Zone A` | Its display name |
| `ZONE_IN_LAT`, `ZONE_IN_LNG` | `53.3881`, `-6.377` | A point **inside** the zone (also the faked browser location) |
| `ZONE_OUT_LAT`, `ZONE_OUT_LNG` | `30.008`, `31.211` | A point **outside** every zone |

### Sample address (used by address tests and fresh-account setup)

| Variable | Default | Meaning |
|---|---|---|
| `SAMPLE_ADDRESS_LINE` | `1 Main St` | Street line |
| `SAMPLE_CITY` | `Dublin` | City |
| `SAMPLE_COUNTRY` | `Ireland` | Country |
| `SAMPLE_POSTAL_CODE` | `D15 X2R4` | Must be valid for the shop's market (the API validates it) |

### Set by tooling (do not put in `.env`)

| Variable | Set by | Effect |
|---|---|---|
| `CI` | GitHub Actions | One retry, `forbidOnly`, GitHub + JSON + HTML reporters |
| `SUITE` | the workflow | `full` (nightly or chosen manually) runs everything; otherwise the smoke subset |

## What happens with partial configuration

| You set | Result |
|---|---|
| Only `BASE_URL` / `API_URL` | Public and validation tests run. Tests that need a customer skip with the reason shown |
| + `TEST_EMAIL` / `TEST_PASSWORD` | Logged-in API and UI tests run on that account. The journey skips its signup steps |
| + complete `MAIL_*` | Every run creates a fresh customer; the full journey runs |
| Mailbox set but signup fails | Falls back to `TEST_EMAIL` if present, with a console warning |
| Nothing | Everything that needs the application is pointed at the placeholder hosts and fails or skips; set the target first |

## `playwright.config.ts`

| Setting | Value | Why |
|---|---|---|
| `testDir` | `./tests` | All specs live under `tests/` |
| `timeout` | 60 s per test | The journey raises its own to 240 s |
| `expect.timeout` | 10 s | Default wait for assertions |
| `workers` | 1 | One shared account and rate-limited endpoints (see [architecture.md](architecture.md)) |
| `retries` | 1 in CI, 0 locally | A pass on retry is reported as "flaky" |
| `forbidOnly` | in CI | A committed `test.only` fails the build |
| `reporter` | list + HTML locally; GitHub + JSON (`results.json`) + HTML in CI | Annotations in the PR, counts for the job summary, a downloadable report |
| `use.baseURL` | `BASE_URL` or the placeholder | Relative `page.goto('/login')` |
| `use.trace` | `retain-on-failure` | A trace is kept only for failures |
| `use.screenshot` | `only-on-failure` | Screenshots only when something broke |
| `projects` | one: Desktop Chrome | Add Firefox, WebKit or mobile devices here |

## npm scripts

| Script | Runs |
|---|---|
| `npm test` | Everything |
| `npm run test:smoke` | Only tests tagged `@smoke` |
| `npm run test:api` | `tests/api` |
| `npm run test:ui` | `tests/ui` and `tests/journey` |
| `npm run report` | Opens the HTML report of the last run |

Useful Playwright flags: `-g "text"` (by name), `--headed`, `--debug`, `--workers=1`, `--project=chromium`,
`--grep @smoke`, `--grep-invert @smoke`, a file or folder path.

## Files the tooling generates (all git-ignored)

`node_modules/`, `playwright-report/`, `test-results/`, `results.json`, `.env`.
