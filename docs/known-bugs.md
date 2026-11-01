# Known bugs and `knownBug()`

## Why this exists

When a test fails because of an **open defect**, the wrong answers are to delete the test, skip it, or leave the run red.
This suite keeps the test asserting the **correct** behaviour and marks it as an *expected failure*:

```ts
test('rejects an address label containing < or >', async () => {
  knownBug('BUG-6', 'address label with < or > is accepted (201)');   // first line of the test
  // ...normal assertions about the correct behaviour...
});
```

## Lifecycle

| Stage | What the run shows |
|---|---|
| Bug open | Test fails as expected → counted as **passed (expected failure)**, run stays **green**, report shows annotation `known-bug: BUG-6: ...` |
| Bug fixed | Test now passes → Playwright reports **"Expected to fail, but passed"** → run goes **red** |
| Clean-up | Delete the `knownBug()` line. The test becomes a normal regression test and guards the fix |

So a green run never hides an unfixed bug, and a fixed bug is noticed within one run.

## Rules

1. Use it only for a defect that has a ticket. Put the ticket id first and a one-line reason second.
2. Never weaken the assertion to make it pass; assert what *should* happen.
3. If the behaviour is intentionally accepted ("agreed behaviour"), change the test instead of using `knownBug()`.
4. A test that depends on something that is simply not available (no mailbox, checkout down) should **skip with a reason**, not use `knownBug()`.
5. Remove the line the same day the red "Expected to fail, but passed" appears.

## Registry

The ids are the anonymised ids used in this repository's tests and docs.

### Active (a `knownBug()` line is in the code today)

| Id | Area | Correct behaviour asserted | Where |
|---|---|---|---|
| BUG-3 | Catalog | Every product has at least one image | `tests/api/catalog.spec.ts` |

### Handled without `knownBug()`

| Id | Area | How it appears in the code |
|---|---|---|
| BUG-4 | Checkout | When checkout fails on the environment, tests that need an order **skip with this reason** (`helpers/orders.ts`, `api/checkout`, `api/payments`, journey steps). They run by themselves once checkout works |
| BUG-8 | Account | `test.skip` placeholder for "a phone used by another account is refused" (needs a second account); the common-password policy on set-password is not automated because it would create accounts |
| BUG-1, BUG-7 | Orders | Agreed behaviour: a second cancel of the same order is a harmless `200` no-op; cancelling an unknown order is `404`. Both are normal tests now |

### Retired (fixed; the line was removed and the test is a normal regression test)

BUG-2 (city name alone does not make an address serviceable), BUG-5 (typed-address check accepted), BUG-6 (address label with `<` or `>` rejected),
BUG-9 (customer cannot see the Operations Dashboard at `/admin`), BUG-10 (logout, basket add and basket clear need the CSRF token).

Add a row to **Active** whenever you add a `knownBug()`, and move it to **Retired** when you remove the line.
