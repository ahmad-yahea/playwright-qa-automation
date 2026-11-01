# CI/CD (GitHub Actions)

One workflow: `.github/workflows/qa.yml`, named **QA**. It is the regression gate for the environment under test.

## Triggers

| Trigger | What runs | Typical time |
|---|---|---|
| Pull request | hygiene + **smoke** (`@smoke` tests) | about 1 minute |
| Push to `main` | hygiene + **smoke** | about 1 minute |
| Every night, 03:00 UTC | hygiene + **full** suite | depends on checkout throttling (the payment matrix adds minutes) |
| Manual (Actions tab → QA → Run workflow) | hygiene + **smoke or full**, your choice | as above |

`concurrency` is set per branch with `cancel-in-progress: false`: two suites never run against the environment at once
(they would trip each other's rate limits).

## Jobs

### `hygiene`
Always runs, needs no secrets, finishes in seconds. Fails the build if:
- a `.env` file (other than `.env.example`) is tracked by git, or
- a tracked file contains a key-like string: Stripe `sk_/pk_/rk_` keys, AWS `AKIA…` keys, GitHub `ghp_…` tokens, private-key headers or a JWT.

`package-lock.json` and the workflow file are excluded from the string scan.

### `test`
1. **Check target environment**: if the `BASE_URL` and `API_URL` repository variables are missing, the job prints a notice and the remaining steps are skipped (the run does not fail).
2. Checkout, set up Node 22 with the npm cache, `npm ci`, install Chromium with its system dependencies.
3. **Run tests**: `npm test` when `SUITE=full`, otherwise `npm run test:smoke`.
4. **Upload report** (always): artifact `playwright-report` containing `playwright-report/`, `test-results/` and `results.json`, kept **14 days**.
5. **Job summary** (always): a table of passed / failed / flaky / skipped read from `results.json`, a pointer to the artifact, and a warning if no mailbox or fallback account was configured.

`timeout-minutes` is 30 for the test job.

## Secrets and variables to configure

Repository → Settings → Secrets and variables → Actions.

| Name | Kind | Needed for |
|---|---|---|
| `BASE_URL`, `API_URL` | variable | **Required.** Without them nothing runs |
| `MAIL_HOST`, `MAIL_PORT` | secret | Fresh account per run (IMAP) |
| `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_ADDRESS_BASE` | secret | Fresh account per run |
| `TEST_EMAIL`, `TEST_PASSWORD` | secret | Fallback customer (also the only customer if no mailbox) |
| `ZONE_IN_ID`, `ZONE_IN_NAME`, `ZONE_IN_LAT`, `ZONE_IN_LNG`, `ZONE_OUT_LAT`, `ZONE_OUT_LNG` | variable | Zone fixtures of your environment |
| `VERIFY_EMAIL_SUBJECT` | variable | Subject of your verification email |

Without the mailbox and fallback secrets the pipeline still runs, but anything that needs a customer is skipped and the
job summary says so.

## Reading a run

| What you see | Meaning |
|---|---|
| Green, everything passed | Healthy |
| Green with some **skipped** | Check the summary: usually no customer or checkout not available. Skips always carry a reason in the report |
| **Flaky** | Failed once, passed on the single CI retry. Look at the trace; do not ignore repeated flakiness |
| Red: "Expected to fail, but passed" | A known bug was fixed: delete its `knownBug()` line ([known-bugs.md](known-bugs.md)) |
| Red: hygiene | A secret or `.env` was committed: rotate the secret first, then remove it |
| Red: a real assertion | A regression. Download the artifact → open `playwright-report/index.html` → open the failed test → trace and screenshot |

To open a downloaded report: unzip, then `npx playwright show-report playwright-report`, or open `index.html`.

## Running the same thing locally

```bash
CI=1 npm run test:smoke      # same retries, forbidOnly and reporters as the pipeline
```

## Cost and runtime notes

- The job installs Chromium with `--with-deps` on every run; the Node cache keeps `npm ci` fast.
- Checkout calls are spaced 13 s apart by `checkout()`, so tests that place orders dominate the nightly duration.
- GitHub Free private repositories have a monthly minute budget; the nightly full run plus per-PR smoke is small, but check usage if you add more projects (browsers) to `playwright.config.ts`.

## Changing the pipeline

- Add a browser: add a project in `playwright.config.ts` and a matching install step (`npx playwright install --with-deps chromium firefox`).
- Run smoke more often or the full suite on `main`: edit the `SUITE` expression in the workflow.
- Keep `concurrency` as is unless the environment tolerates parallel suites.
