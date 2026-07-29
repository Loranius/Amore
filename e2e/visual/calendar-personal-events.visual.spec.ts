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

test('Календар: лише наші події та дні народження на Pixel 8 Pro', async ({ page }, testInfo) => {
  await login(page);
  await page.goto('./#/calendar', { waitUntil: 'networkidle' });

  const viewPicker = page.getByRole('group', { name: 'Вигляд календаря' });
  await viewPicker.getByRole('button', { name: /Список/ }).click();

  await expect(page.getByRole('tab', { name: /Наші свята/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Дні народження/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Свята', exact: true })).toHaveCount(0);
  await expect(page.locator('.relationship-journey')).toBeVisible();
  await expectInsideViewport(page, '.calendar');
  await expectInsideViewport(page, '.relationship-journey');

  await page.getByRole('button', { name: /Додати/, exact: false }).first().click();
  const relationshipForm = page.locator('.cal-entry-sheet');
  await expect(relationshipForm).toBeVisible();
  await expect(relationshipForm.getByText('Наші свята', { exact: true })).toBeVisible();
  await expect(relationshipForm.getByRole('button', { name: /Подія Новий важливий момент/ })).toBeVisible();
  await expect(relationshipForm.getByRole('button', { name: /Велика подія Пропозиція/ })).toBeVisible();
  await expect(relationshipForm.getByText('Тип', { exact: true })).toHaveCount(0);
  await expectInsideViewport(page, '.cal-entry-sheet');
  await relationshipForm.screenshot({ path: testInfo.outputPath('calendar-relationship-event-form.png') });

  await relationshipForm.getByRole('button', { name: /Велика подія Пропозиція/ }).click();
  await expect(relationshipForm.getByRole('button', { name: /Велика подія Пропозиція/ })).toHaveAttribute('aria-pressed', 'true');
  await relationshipForm.getByRole('button', { name: 'Скасувати' }).click();

  await page.getByRole('tab', { name: /Дні народження/ }).click();
  await page.getByRole('button', { name: /Додати/, exact: false }).first().click();
  const birthdayForm = page.locator('.cal-entry-sheet');
  await expect(birthdayForm).toBeVisible();
  await expect(birthdayForm.getByText('Дні народження', { exact: true })).toBeVisible();
  await expect(birthdayForm.getByRole('button', { name: /Велика подія/ })).toHaveCount(0);
  await expectInsideViewport(page, '.cal-entry-sheet');
  await birthdayForm.screenshot({ path: testInfo.outputPath('calendar-birthday-form.png') });
});
