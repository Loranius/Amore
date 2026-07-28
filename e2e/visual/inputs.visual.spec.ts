// ============================================================
// Жодне поле вводу не має лишатись світлим у темній темі.
// ------------------------------------------------------------
// Баг, який це ловить, прожив довго саме тому, що його не видно у
// світлій темі: поле поза `.form-field` не отримувало з глобальних
// стилів жодних кольорів і лишалось типовим БІЛИМ прямокутником
// браузера. На світлому тлі це майже непомітно, на темному — біла
// пляма посеред екрана.
//
// Перевірка вимірює яскравість фону, а не порівнює знімки: нова форма
// в будь-якому модулі має ламати цей тест, не чекаючи на оновлення
// еталонних картинок.
// ============================================================
import { expect, test } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME;
const visualUserPin = process.env.VISUAL_USER_PIN;

/** Маршрути з формами. Хеш — бо роутер HashRouter (GitHub Pages). */
const ROUTES = [
  '/#/plans',
  '/#/shopping',
  '/#/wishlist',
  '/#/piggybank',
  '/#/calendar',
  '/#/map',
  '/#/memories',
];

/** Типи, у яких фон означає зовсім інше й задавати його не треба. */
const IGNORED_TYPES = ['checkbox', 'radio', 'range', 'file', 'color', 'button', 'submit', 'reset', 'image'];

async function login(page: import('@playwright/test').Page) {
  test.skip(!visualUserName || !visualUserPin, 'Visual login secrets are required');

  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: /Хто сьогодні заходить у портал/ })).toBeVisible();
  await page.getByRole('button', { name: visualUserName!, exact: true }).click();
  for (const digit of visualUserPin!) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => !url.hash.includes('/login'), { timeout: 15_000 });
}

test('Темна тема: жодне поле вводу не лишається світлим', async ({ page }) => {
  // Тему читає ThemeProvider із localStorage до першого рендеру, тож
  // ставимо її ДО завантаження застосунку — інакше перший кадр був би
  // світлим і перевірка міряла б не те.
  await page.addInitScript(() => window.localStorage.setItem('amore:theme', 'dark'));
  await login(page);

  const offenders: string[] = [];

  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator('#root')).toBeVisible();
    // Дані приїжджають асинхронно, а форми часто під ними.
    await page.waitForTimeout(1500);

    const light = await page.evaluate((ignored) => {
      const luminance = (color: string): number | null => {
        const parts = color.match(/[\d.]+/g);
        if (!parts) return null;
        const [r, g, b, a] = parts.map(Number);
        if (a === 0) return null; // прозоре — успадковує тло, це нормально
        return (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) / 255;
      };
      const out: string[] = [];
      for (const el of document.querySelectorAll('input, select, textarea')) {
        const type = (el.getAttribute('type') ?? 'text').toLowerCase();
        if (ignored.includes(type)) continue;
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        const l = luminance(style.backgroundColor);
        if (l !== null && l > 0.5) {
          out.push(`${el.id || el.getAttribute('name') || el.className || type} (${style.backgroundColor})`);
        }
      }
      return out;
    }, IGNORED_TYPES);

    for (const field of light) offenders.push(`${route}: ${field}`);
  }

  expect(offenders, `Світлі поля в темній темі:\n${offenders.join('\n')}`).toEqual([]);
});

test('Темна тема: color-scheme каже браузеру малювати рідні віджети темними', async ({ page }) => {
  // Календарик у input[type=date], стрілка select і смуги прокрутки —
  // не наші пікселі. Без color-scheme вони лишаються світлими навіть
  // тоді, коли саме поле вже темне.
  await page.addInitScript(() => window.localStorage.setItem('amore:theme', 'dark'));
  await login(page);

  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(scheme).toBe('dark');
});
