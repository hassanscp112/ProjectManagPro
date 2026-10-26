import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

// End-to-end smoke tests (`npm run test:e2e`, specs in e2e/). They start
// their own dev server on port 5190 with an empty browser profile, so the
// real data on :5173 is never touched. First run: `npx playwright install
// chromium`.
const PORT = 5190

export default defineConfig({
  testDir: './e2e',
  // One test at a time: every page load pulls hundreds of unbundled modules
  // from the dev server, and parallel smoke walks run out of browser
  // resources (net::ERR_INSUFFICIENT_RESOURCES).
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  // A smoke test walks every screen in one page; give it room.
  timeout: 5 * 60 * 1000,
  expect: { timeout: 10 * 1000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    actionTimeout: 15 * 1000,
    navigationTimeout: 30 * 1000,
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 2 * 60 * 1000,
  },
})
