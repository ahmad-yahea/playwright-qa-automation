# Coverage matrix

Types: **API** (backend, no browser), **UI** (browser), **Journey** (end-to-end step).
Status: **runs** = always; **needs account** = needs MAIL_* or TEST_EMAIL; **needs checkout** = skips with the reason while checkout fails on the test environment;
**known bug** = asserts correct behaviour, expected to fail until fixed (see `knownBug()` in the README). **@smoke** = in the quick smoke run.

## Customer journey (`tests/journey`)
| Step | Type | Status |
|---|---|---|
| Guest opens the home page | Journey | runs |
| Signup form, verification email, set password | Journey | needs mailbox (MAIL_*) |
| Login through the pop-up | Journey | needs account |
| Onboarding data present (address, zone) | Journey | needs account |
| Browse and search | Journey | runs |
| Add to basket, checkout page | Journey | needs account |
| Place order, My Orders, cancel and refund | Journey | needs checkout |
| Logout, private pages ask for login | Journey | runs |

## Auth
| Behaviour | Type | Status |
|---|---|---|
| Wrong password = 401, generic message | API | runs, @smoke |
| Unknown email gets the same message | API | runs, @smoke |
| 6th wrong attempt locks the account | API | runs |
| Signup rejects empty body, invalid email | API | runs, @smoke |
| Signup rejects empty name, disposable domain | API | runs |
| Signup refuses out-of-zone location (403) | API | runs (skips on 429) |
| Login form fields, wrong-password error | UI | runs |
| Signup form blocks an empty email | UI | runs |

## Account
| Behaviour | Type | Status |
|---|---|---|
| Rejects phone "abc" / "+3531" (E.164) | API | needs account |
| Refuses changing role / email via profile | API | needs account |
| Lists saved addresses with coordinates | API | needs account |
| Rejects a bad postal code | API | needs account |
| Rejects address label with < or > | API | known bug BUG-6 |
| Rejects a phone used by another account | API | skipped (needs a second account, BUG-8) |
| Common-password policy on set-password | - | not automated (would create accounts), BUG-8 |

## Catalog and zones
| Behaviour | Type | Status |
|---|---|---|
| Categories, real moods, only published products | API | runs, @smoke |
| Price > 0 and stock number on every product | API | runs |
| Every product has an image | API | known bug BUG-3 |
| In-zone serviceable, out-of-zone not | API | runs, @smoke |
| Off-zone point refused even if city matches | API | runs |
| City name alone is not accepted | API | known bug BUG-2 |
| Typed-address check (`?address=`) accepted | API | known bug BUG-5 |

## Cart
| Behaviour | Type | Status |
|---|---|---|
| Visitor sees an empty basket | API | runs, @smoke |
| Add product (201), total matches | API | needs account, @smoke |
| Quantity 0 / -1 / "two" / 1.5 / 99999 = 400 | API | needs account, @smoke |
| Unknown product 404, out of stock 409, over stock 409 | API | needs account |

## Checkout and payments
| Behaviour | Type | Status |
|---|---|---|
| Missing paymentSource = 400 (checkout call 1 of 2) | API | needs account |
| Unknown zone = 404 (checkout call 2 of 2) | API | needs account |
| Order with a Stripe test card | API | needs checkout |
| Declines (generic, insufficient funds, expired, CVC, processing) keep the basket | API | needs checkout |
| 3DS card is not confirmed before authentication | API | needs checkout |
| Same idempotency key twice = one order | API | needs checkout |
| Checkout page shows summary and Place order | UI | needs account |

## Orders
| Behaviour | Type | Status |
|---|---|---|
| Unknown order 404, non-uuid 400 | API | needs account, @smoke |
| Cancel unknown order = 404 | API | known bug BUG-7 |
| Order lookup shows a status | API | needs checkout |
| Cancel once ok, second cancel refused | API | needs checkout |

## Session, security, access
| Behaviour | Type | Status |
|---|---|---|
| No public guest-checkout endpoint (404) | API | runs, @smoke |
| Protected call without login = 401 | API | runs, @smoke |
| Logout ends the session | API | needs account |
| Logout / cart add / cart clear need the CSRF token | API | known bug BUG-10 (3 tests) |
| Logged-out visitor asked to log in on /browse/orders | UI | runs |
| Customer cannot see the Operations Dashboard at /admin | UI | known bug BUG-9 |

## Browse and search
| Behaviour | Type | Status |
|---|---|---|
| Search box and results stay in sync | UI | needs account |
| Header shows the saved address zone (inside / outside the zone) | UI | needs account |

## Login and signup forms, responsive, health (`tests/ui`)
| Behaviour | Type | Status |
|---|---|---|
| Password is masked and the show/hide button toggles it | UI | runs (API mocked) |
| Enter key submits the login form once | UI | runs (API mocked) |
| Double click on Log in sends one request | UI | runs (API mocked) |
| Network failure on login shows an error, not a hang | UI | runs (API mocked) |
| Malformed email rejected without sending a signup | UI | runs (API mocked) |
| Double click on Continue sends one signup | UI | runs (API mocked) |
| Name with accents is accepted and sent unchanged | UI | runs (API mocked) |
| Script tag in the name never runs | UI | runs (API mocked) |
| Denied location permission does not leave the page hanging | UI | runs |
| Public pages fit every width (360 to 2560 px) | UI | runs |
| Storefront pages fit every width | UI | needs account |
| Home page has no script errors / no missing files | UI | runs, **@smoke** |

## Ideas to add next
Promo codes, mobile device projects (add them in `playwright.config.ts`), order tracking status changes, password reset flow, rider/admin areas.
