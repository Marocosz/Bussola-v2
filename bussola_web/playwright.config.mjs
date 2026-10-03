import { defineConfig, devices } from '@playwright/test';

const mobile = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.002, animations: 'disabled' } },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.mjs',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    storageState: 'e2e/.auth/state.json',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  },
  projects: [
    { name: 'desktop', testMatch: /.*\.desktop\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', testMatch: /.*\.mobile\.spec\.mjs/, use: { ...devices['Desktop Chrome'], ...mobile } },
    { name: 'tablet', testMatch: /.*\.tablet\.spec\.mjs/, use: { ...devices['Desktop Chrome'], viewport: { width: 900, height: 1200 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      command: 'powershell -NoProfile -ExecutionPolicy Bypass -File e2e/demo-backend.ps1',
      url: 'http://127.0.0.1:8000/docs',
      reuseExistingServer: true,
      timeout: 240_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      // Client id falso e fixo (o Playwright soma este env ao process.env; nunca usa um id real do
      // ambiente): o GoogleOAuthProvider do main.jsx exige um client_id. As specs de Auth ainda
      // bloqueiam o GSI (e2e/fixtures/auth.mjs).
      env: { VITE_GOOGLE_CLIENT_ID: 'e2e-dummy.apps.googleusercontent.com' },
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
