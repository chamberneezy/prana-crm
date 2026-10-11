import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ holds the Playwright smoke flows, which run with `npm run e2e`.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'e2e-demo/**'],
  },
});
