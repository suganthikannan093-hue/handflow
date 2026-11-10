import { defineConfig } from '@playwright/test';

/** Viewport 1280x700 matches a headed 1280x800 Chrome window after browser chrome. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180000,
  expect: { timeout: 30000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1280, height: 700 },
    headless: true,
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--window-size=1280,800'],
    },
  },
  webServer: {
    command: 'HTTP_ONLY=1 npx vite --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
