# Security and data handling

## Secrets

| Rule | How it is enforced |
|---|---|
| No credentials in the repository | `.env` is git-ignored; `.env.example` has placeholders only; the **hygiene** CI job fails on a tracked `.env` or key-like strings |
| Real values live in `.env` locally and GitHub Secrets / Variables in CI | `playwright.config.ts` loads `.env`; the workflow maps secrets to environment variables |
| Mailbox uses an **app password**, never the account password | Documented in [configuration.md](configuration.md) |
| Secrets are never printed | Helpers throw errors with status codes and hints, not credentials |
| If a secret is ever committed: **rotate it first**, then remove it | Removing a commit does not unpublish it |

Secret variables: `MAIL_USER`, `MAIL_PASSWORD`, `TEST_EMAIL`, `TEST_PASSWORD` (and in practice `MAIL_HOST`/`MAIL_ADDRESS_BASE` if they identify a real mailbox).

## Payments

- Only Stripe **test** payment-method ids are used (`PM` in `helpers/orders.ts`). **No card number is typed** anywhere, in code or tests.
- Point the suite only at environments in **test mode**. Never at production payments.

## What the suite creates

| Action | Data created | Cleaned up? |
|---|---|---|
| Fresh account per run | One customer (a `+alias` of the mailbox), with phone, address and onboarding | **No.** Account deletion is not automated. Nightly runs add one customer a day; ask the application team for a clean-up job if that matters |
| Journey and order tests | One order | Cancelled and refunded by the tests |
| Address validation tests | Nothing permanent | If a bad address is wrongly accepted, the test deletes it |
| Signup validation (API) | Nothing | Every case is rejected |
| Lockout test | Nothing real | Uses a throwaway email, never a real account |
| Form-behaviour UI tests | Nothing | The API is mocked in the browser |

## Safety rules for anyone running the suite

1. Run it only against environments you own or are authorised to test.
2. Do not raise `workers` above 1 against a shared environment: you will trip rate limits and disturb other people's runs.
3. Do not add loops that hammer login or signup. The lockout test already covers the rule with one throwaway email.
4. Use a dedicated mailbox and dedicated test accounts, never a personal one.
5. Do not paste real customer data, order ids, hosts or tokens into code, docs, issues or commit messages.

## What the security-flavoured tests check

| Area | Check | File |
|---|---|---|
| Account enumeration | An unknown email and a wrong password return the same message | `api/auth` |
| Lockout | The account locks after repeated wrong passwords | `api/auth` |
| CSRF | Logout, basket add and basket clear are refused without the CSRF token | `api/session-security` |
| Session | After logout the old cookies stop working | `api/session-security` |
| Access control | Protected calls without login are 401; a customer cannot see the staff dashboard | `api/session-security`, `ui/access-control` |
| Input validation | Bad phone, bad postal code, unsafe address labels, disposable email domains are rejected | `api/account`, `api/auth` |
| Hostile input | A script tag in a name never executes | `ui/signup-validation` |
| Removed endpoints | There is no public guest-checkout endpoint | `api/session-security` |

## Reporting a vulnerability in this repository

Open a private security advisory on GitHub, or contact the repository owner directly. Please do not open a public issue
for a security problem.
