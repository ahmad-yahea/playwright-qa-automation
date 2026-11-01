# Troubleshooting

Find your symptom, read the cause, apply the fix.

## Everything is skipped

| Symptom | Cause | Fix |
|---|---|---|
| Report shows many skips, reason "No test account..." | No mailbox settings and no `TEST_EMAIL` / `TEST_PASSWORD` | Set `MAIL_*` (fresh account per run) or the fallback account in `.env` / CI secrets |
| Skips with "Checkout is not working on this environment" | The one shared order attempt failed, so every test that needs an order skips with the same reason | Check the status and message in the reason; fix checkout on the environment. The tests start running by themselves |
| Journey shows `[SKIPPED: MAIL_* not set]` steps | No mailbox | Configure the mailbox, or accept that signup steps are skipped |
| CI job only prints a notice | `BASE_URL` / `API_URL` variables missing | Add them under Settings → Secrets and variables → Actions → Variables |

## Rate limits

| Symptom | Cause | Fix |
|---|---|---|
| `Login failed with 429 ...` | Too many logins from one IP (many runs, or other tools on the same network) | Wait a few minutes. The suite logs in once per run |
| `Signup failed with 429` | Signup burst limit | Wait, then run again. The fresh-account helper falls back to `TEST_EMAIL` if set |
| 429 on checkout | A checkout call bypasses `checkout()` | Route it through `checkout()` (spaced 13 s) |
| Lockout test is skipped with "signup rate limit reached" | The signup validation call hit 429 | Run again later |

## Write calls fail

| Symptom | Cause | Fix |
|---|---|---|
| 403 on a POST/PATCH/DELETE | The `X-CSRF-Token` header is missing | Send `writeHeaders(session)` |
| 401 on a call that worked a minute ago | The session ended (a logout test used the shared one) | Use `ownSession(s)` for tests that end the session |

## Verification email problems

| Symptom | Cause | Fix |
|---|---|---|
| `Verification email for ... did not arrive in 90s` | Wrong `MAIL_*`, IMAP disabled, the email is in spam, or the subject differs | Check host/port/user, that IMAP is enabled, the spam folder, and that `VERIFY_EMAIL_SUBJECT` matches the real subject |
| Gmail rejects the login | Using the account password | Turn on 2-Step Verification and create an **app password** |
| Microsoft 365 rejects the login | Basic authentication is disabled for the tenant | Use another provider or a shared mailbox that allows IMAP app passwords |
| Email arrives but no link is found | The link format changed | Update the regex in `mailbox.ts` (`verify-email?token=`) |
| Public throwaway inboxes fail at signup | The application refuses disposable domains | Use a real mailbox |

## Expected-failure surprises

| Symptom | Cause | Fix |
|---|---|---|
| Red: "Expected to fail, but passed" | A known bug was fixed | Delete its `knownBug()` line; see [known-bugs.md](known-bugs.md) |
| A test shows as passed but is annotated `known-bug` | Bug still open (expected failure) | Nothing to do; it turns red on the day it is fixed |

## Browser problems

| Symptom | Cause | Fix |
|---|---|---|
| `Executable doesn't exist` | Browsers not installed | `npx playwright install chromium` |
| Locator timeouts on the first test of a UI file | The shop sends logged-out users to a login pop-up, or the "location" pop-up covers the page | Use `loggedInContext(browser)` which logs in and fakes the location |
| Signup form never appears | The location gate ("we're not in your area") | Fake a location inside the zone (`geolocation` + `permissions` in `test.use`) |
| Works headed, fails in CI | Timing or viewport difference | Open the trace from the report artifact; replace fixed waits with `expect` conditions |
| Sideways-scroll failure in `responsive` | A real layout overflow | The message lists the widest elements and the width at which it fails |

## Local setup

| Symptom | Fix |
|---|---|
| `Cannot find module` | `npm install` (or `npm ci`) |
| TypeScript error in a spec | `npx playwright test --list` compiles every spec and shows the error |
| `.env` is ignored by tests | It must be in the project root, next to `package.json` |
| The report does not open | `npm run report` after a run; in CI, download the artifact first |

## Reading the failure artifacts

1. Open the HTML report (`npm run report`, or `playwright-report/index.html` from the CI artifact).
2. Open the failed test: the steps, the error, the screenshot and the **trace**.
3. In the trace, step through the actions and check the network tab for the failing API call and its response.
4. `results.json` holds the same results for scripts and the job summary.

## Still stuck

Re-run the single test with the debugger: `npx playwright test path/to/file.spec.ts -g "test name" --headed --debug`.
