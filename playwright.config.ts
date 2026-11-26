import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Laptop: load values from the (git-ignored) .env file.
// Pipeline: there is no .env, the same variable names come from GitHub Secrets and Variables.
dotenv.config({ quiet: true });

const isCI = !!process.env.CI;
const PORT = 3000;
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 30_000,
  expect: { timeout: 7_000 },

  reporter: isCI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Starts the app before the tests (npm start), waits for /api/health, stops it afterwards.
  // If BASE_URL is set, the tests run against that deployed environment and no local app is started.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm start',
        url: `http://localhost:${PORT}/api/health`,
        reuseExistingServer: !isCI,
        timeout: 30_000,
      },

  projects: [
    // 1. Log in once and save the sessions.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },

    // 2. UI tests start already logged in (browser state saved by the setup project).
    {
      name: 'ui-chromium',
      testMatch: 'ui/**/*.spec.ts',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: '.auth/ui-state.json' },
    },

    // 3. API tests read the saved tokens.
    { name: 'api', testMatch: 'api/**/*.spec.ts', dependencies: ['setup'] },
  ],
});
