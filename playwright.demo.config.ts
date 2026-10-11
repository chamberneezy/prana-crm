import { defineConfig, devices } from '@playwright/test';

// Checks the public demo build exactly as GitHub Pages serves it: static files under /prana-crm/,
// no API server, no Auth emulator. Run with `npm run e2e:demo`.
const BASE = '/prana-crm/';

export default defineConfig({
  testDir: 'e2e-demo',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:5175${BASE}`,
    locale: 'hr-HR',
    timezoneId: 'Europe/Zagreb',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build:demo -w @prana/web && npm run preview -w @prana/web -- --port 5175 --strictPort',
    url: `http://localhost:5175${BASE}`,
    env: { VITE_BASE: BASE },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
