import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config'; // loads .env into process.env (in CI the values come from secrets/vars)

const CI = !!process.env.CI;

/**
 * One browser (Chromium) on purpose: fast and easy to read. Add projects here for Firefox/WebKit/mobile later.
 * workers: 1 because tests share one account (basket) and the QA API throttles checkout (~5/min) and login.
 * CI differences: one retry for network flakiness (a pass on retry is reported as "flaky"), forbidOnly,
 * and the GitHub reporter next to the HTML report.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [['github'], ['json', { outputFile: 'results.json' }], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://shop.example.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
