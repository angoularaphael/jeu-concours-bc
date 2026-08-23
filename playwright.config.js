import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:5620';
const isLocal = /localhost|127\.0\.0\.1/.test(baseURL);

export default defineConfig({
  testDir: './test/e2e',
  timeout: 45000,
  expect: { timeout: 8000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL,
    trace: 'off',
    viewport: { width: 390, height: 844 },
  },
  webServer: isLocal
    ? {
        command: 'node server/dev-api.js --vite',
        url: 'http://127.0.0.1:5620',
        reuseExistingServer: true,
        timeout: 180000,
        stdout: 'pipe',
        stderr: 'pipe',
        env: {
          ...process.env,
          LEADS_BACKEND: 'memory',
          DRY_RUN: '1',
          API_PORT: '5621',
          ADMIN_TOKEN: 'test-admin',
        },
      }
    : undefined,
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
