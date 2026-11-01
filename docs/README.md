# Documentation

Everything about this project, from "how do I run it" to "how does each helper work".
Start with the root [README](../README.md) for the five-minute version, then use this map.

| I want to... | Read |
|---|---|
| Understand how the suite is built and why | [architecture.md](architecture.md) |
| Set every environment variable and know what each does | [configuration.md](configuration.md) |
| See every test file: purpose, needs, what it creates | [test-suites.md](test-suites.md) |
| See every test by feature with its type and status | [test-cases.md](test-cases.md) |
| Use or change a helper (API client, browser login, mailbox, orders) | [helpers-reference.md](helpers-reference.md) |
| Write a new test the way this project does | [writing-tests.md](writing-tests.md) |
| Track open defects asserted by the suite | [known-bugs.md](known-bugs.md) |
| Understand the pipeline, its secrets and its reports | [ci-cd.md](ci-cd.md) |
| Fix a failing or skipped run | [troubleshooting.md](troubleshooting.md) |
| Know what data the suite creates and how secrets are handled | [security-and-data.md](security-and-data.md) |

## Vocabulary

- **API test**: calls the backend directly, no browser.
- **UI test**: drives a real browser (Chromium).
- **Journey**: one serial end-to-end story (signup to logout) shown step by step in the report.
- **Session**: a logged-in API client (cookies + CSRF token) created by `helpers/apiClient.ts`.
- **Fresh account**: a customer created through the real signup during the run (needs a mailbox).
- **Fallback account**: a pre-verified customer from `TEST_EMAIL` / `TEST_PASSWORD`, used when no mailbox is set.
- **Smoke**: the quick subset tagged `@smoke`, run on every pull request.
- **Known bug**: a test that asserts the correct behaviour but is expected to fail until the defect is fixed (see [known-bugs.md](known-bugs.md)).
- **Mocked**: the browser intercepts the request and answers it itself, so nothing reaches the server.
