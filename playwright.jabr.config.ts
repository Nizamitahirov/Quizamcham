import { defineConfig } from '@playwright/test'

/**
 * Jabr serverinə (Postgres) qarşı e2e testlər: npx playwright test -c playwright.jabr.config.ts
 * Əvvəlcə server ALLOW_TEST_AUTH=1 ilə 3100 portunda işləməlidir (CI-də "e2e-jabr" işi qaldırır).
 */
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
export default defineConfig({
  testDir: 'e2e/jabr',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:5174', viewport: { width: 1400, height: 950 }, launchOptions: { proxy }, trace: 'retain-on-failure', acceptDownloads: true },
  webServer: {
    command: 'npx vite --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: true, timeout: 90_000,
    env: { VITE_BACKEND: 'jabr', JABR_API: process.env.JABR_API ?? 'http://127.0.0.1:3100' },
  },
})
