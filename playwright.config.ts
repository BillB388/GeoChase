import os from 'node:os';
import { defineConfig, devices } from '@playwright/test';

const cpus = os.availableParallelism?.() ?? os.cpus().length;
const baseURL = process.env.GEOCHASE_TEST_URL || 'http://localhost:3000';

/**
 * Playwright configuration for E2E testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/deployment.spec.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Reserve 2 cores for system/dev server, minimum 1 worker */
  workers: Math.max(1, cpus - 2),

  /* Reporter to use - 'list' for fast console output, 'html' for detailed reports */
  reporter: process.env.CI ? 'html' : 'list',

  /* Shorter timeout for faster failure detection */
  timeout: 15_000,

  /* Stop immediately on first failure */
  maxFailures: 1,

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL,

    /* Disable trace for faster execution (enable on-first-retry if debugging needed) */
    trace: 'off',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Disable video recording for speed (screenshots are sufficient) */
    video: 'off',

    /* Faster action timeout */
    actionTimeout: 10_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment to test on Firefox
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Uncomment to test on WebKit (Safari)
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes to start
  },
});
