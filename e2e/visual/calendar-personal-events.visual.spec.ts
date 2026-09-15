import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function login(page: Page) {
  test.skip(!visualUserName || !visualUserPin, 'Visual login secrets are required');

  await page.goto('./#/login', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: visualUserName!, exact: true }).click();
  for (const digit of visualUserPin!) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL(/#\/?$/, { timeout: 20_000 });
}

async function expectInsideViewport(page: Page, selector: string) {
  const viewport = page.viewportSize();
  const box = await page.locator(selector).boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test('Плани: календар і наш шлях на Pixel 8 Pro', async ({ page }, testInfo) => {
  await login(page);

  // /calendar is intentionally kept as a legacy address. The calendar now
  // lives inside the unified Plans module and the old URL must land there.
  await page.goto('./#/calendar', { waitUntil: 'networkidle' });
  await page.waitForURL(/#\/plans(?:\?.*)?$/, { timeout: 20_000 });

  const module = page.locator('.plans-module');
  await expect(module).toBeVisible();

  /*
   * ТУТ СТОЯЛИ ВКЛАДКИ «Розділи планів» І `data-section`. Їх немає:
   * плани й календар зведені в один сувій. Тест падав у CI на атрибуті,
   * якого ніхто не знімає, — і саме тому не стеріг нічого.
   */
  const calendar = page.locator('.cal-month');
  await expect(calendar).toBeVisible();
  await expectInsideViewport(page, '.cal-month');
  await page.screenshot({
    path: testInfo.outputPath('plans-calendar-pixel-8-pro.png'),
    fullPage: true,
  });

  /*
   * «НАШ ШЛЯХ» ПЕРЕЇХАВ ІЗ ПЛАНІВ НА ВЛАСНИЙ МАРШРУТ (ADR-0037 §переїзд).
   *
   * Тест шукав його у вкладці «Події» всередині планів. Такої вкладки
   * більше немає, і це не переніс верстки: власник попросив прибрати
   * проміжну зупинку, тож сузір'я відкривається дотиком по лічильнику
   * днів на головній — і БІЛЬШЕ НІЗВІДКИ. Друга дорога до нього зникла
   * навмисно, тож тест, який її шукає, стереже неіснуючу вимогу.
   */
  await page.goto('./#/journey', { waitUntil: 'networkidle' });
  const journey = page.locator('.journey-page');
  await expect(journey).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('journey-pixel-8-pro.png'),
    fullPage: true,
  });

  // Подія стосунку додається звідси ж, і форма та сама, що в календарі.
  await page.locator('.journey-page .fab').click();
  const relationshipForm = page.locator('.cal-entry-sheet');
  await expect(relationshipForm).toBeVisible();
  await expect(relationshipForm.getByRole('heading', { name: 'Нова подія' })).toBeVisible();
  await expectInsideViewport(page, '.cal-entry-sheet');
  await relationshipForm.screenshot({ path: testInfo.outputPath('journey-event-form.png') });
  await relationshipForm.getByRole('button', { name: 'Скасувати' }).click();
  await expect(relationshipForm).toBeHidden();
});
