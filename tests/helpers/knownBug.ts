import { test } from '@playwright/test';

/**
 * Marks the CURRENT test as a known bug. Call it as the first line of the test.
 * The test keeps asserting the CORRECT behaviour. While the bug is open the assertion fails, which
 * Playwright treats as "expected failure" (green run, listed with the ticket id in the report).
 * The day the bug is fixed the test passes -> Playwright reports "Expected to fail, but passed" and the
 * run goes RED. Fix: delete the knownBug() line. That is how fixes get noticed and cleaned up.
 */
export function knownBug(ticket: string, reason: string) {
  test.info().annotations.push({ type: 'known-bug', description: `${ticket}: ${reason}` });
  test.fail(true, `Known bug ${ticket}: ${reason}. If this now passes, the bug is fixed: remove knownBug().`);
}
