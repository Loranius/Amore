import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4174/';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?.trim() || undefined;

export default defineConfig({
  testDir: './e2e/godot',
  testMatch: '**/*.spec.ts',
  outputDir: 'test-results/godot-playwright',
  timeout: 120_000,
  expect: {
    timeout: 90_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report-godot', open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'uk-UA',
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    browserName: 'chromium',
    viewport: { width: 448, height: 998 },
    screen: { width: 448, height: 998 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--enable-unsafe-swiftshader',
        '--use-angle=swiftshader-webgl',
      ],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174',
    url: `${baseURL}e2e/godot/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
