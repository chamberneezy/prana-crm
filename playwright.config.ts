import { defineConfig, devices } from '@playwright/test';

// The smoke flows run against their own servers and database, so they never touch dev data:
// the Auth emulator, the API on 8788 with a freshly seeded database, and the web app on 5174.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5174',
    locale: 'hr-HR',
    timezoneId: 'Europe/Zagreb',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx firebase emulators:start --only auth --project prana-crm',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run e2e:serve -w @prana/api',
      url: 'http://localhost:8788/api/me',
      // Any answer means it is up; without a token this one is 401.
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @prana/web -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      env: { API_PROXY_TARGET: 'http://localhost:8788' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
