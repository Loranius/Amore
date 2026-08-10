import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173/';

/**
 * Готовий Chromium замість того, що качає Playwright.
 *
 * Порожня змінна — і нічого не змінюється: у CI крок `playwright install`
 * ставить свою збірку, і конфіг лишається таким, яким був. Змінна потрібна
 * там, де браузер уже стоїть в образі, а версія збірки не збігається з тією,
 * якої чекає раннер, — інакше весь набір падає з «Executable doesn't exist»
 * ще до першої перевірки. Прапорці SwiftShader їдуть разом із нею: у такому
 * образі WebGL без них не піднімається, а без WebGL цей набір не має сенсу.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM?.trim();
const localBrowser = chromiumPath
  ? {
      launchOptions: {
        executablePath: chromiumPath,
        args: [
          '--enable-webgl',
          '--ignore-gpu-blocklist',
          '--enable-unsafe-swiftshader',
          '--use-angle=swiftshader-webgl',
        ],
      },
    }
  : {};

export default defineConfig({
  testDir: './e2e/visual',
  outputDir: 'test-results/playwright',
  // Сорок п'ять секунд не вистачало на власну роботу застосунку, а не на ваду.
  //
  // Виміряно в CI: тести, які проходять, займають по 13–15 секунд, а ті, що
  // падали за часом, робили в одному тесті логін і три тривимірні збірки
  // (кристал, дерево, риф) — рівно 45.000 мс і «Test timeout exceeded» замість
  // будь-якої змістовної помилки. На спільному раннері без GPU це не запас, а
  // межа, і вона повідомляє про раннер, а не про портал.
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL,
    locale: 'uk-UA',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'pixel-8-pro-chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 448, height: 998 },
        screen: { width: 448, height: 998 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        ...localBrowser,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --host 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
