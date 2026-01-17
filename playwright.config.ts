import { defineConfig, devices } from '@playwright/test'

const isCi = Boolean(process.env.CI)
const host = process.env.E2E_HOST || '127.0.0.1'
const appPort = Number(process.env.E2E_APP_PORT || 5173)
const restPort = Number(process.env.E2E_REST_PORT || 3000)
const wsPort = Number(process.env.E2E_WS_PORT || 3001)

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: `http://${host}:${appPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer:
    process.env.E2E_MANAGED_SERVERS === '1'
      ? []
      : [
          {
            command: 'node --experimental-strip-types server/mock.ts',
            url: `http://${host}:${restPort}/api/health`,
            reuseExistingServer: !isCi,
            env: {
              REST_PORT: String(restPort),
              WS_PORT: String(wsPort),
              REST_HOST: host,
              WS_HOST: host,
              WS_DEBUG: '1',
              WS_PRODUCT_UPDATE_INTERVAL_MS: '60000',
              WS_CART_SYNC_INTERVAL_MS: '60000',
              MOCK_API_DELAY_MS_MIN: '0',
              MOCK_API_DELAY_MS_MAX: '0',
              MOCK_API_FAIL_RATE: '0',
            },
          },
          {
            command: `pnpm dev -- --host ${host} --port ${appPort} --strictPort`,
            url: `http://${host}:${appPort}`,
            reuseExistingServer: !isCi,
            env: {
              VITE_PROXY_TARGET: `http://${host}:${restPort}`,
              VITE_WS_URL: `ws://${host}:${wsPort}`,
            },
          },
        ],
})
