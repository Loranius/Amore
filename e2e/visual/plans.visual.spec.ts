import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Plans mobile visual preview', () => {
  test('captures the current unified Plans module', async ({ page }, testInfo) => {
    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'Plans capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();
    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/plans', { waitUntil: 'networkidle' });

    const module = page.locator('.plans-module');
    await expect(module).toBeVisible();

    /*
     * ТУТ СТОЯЛИ `data-section="calendar"` І ВКЛАДКИ «Розділи планів».
     * Ні того, ні тих у модулі більше немає: плани й календар зведені в
     * ОДИН сувій, де місяць угорі, а розділи під ним. Тест цього не
     * помітив і півтора місяця падав у CI на атрибуті, якого ніхто не
     * знімав, — а падаючий тест не стереже нічого.
     *
     * Тому перевіряється те, що справді визначає модуль сьогодні: місяць
     * і аркуш під ним.
     */
    await expect(page.locator('.pm-sheet')).toBeVisible();
    await expect(page.locator('.cal-month')).toBeVisible();

    const addButton = page.locator('.plans-module .fab');
    await expect(addButton).toBeVisible();
    const addBox = await addButton.boundingBox();
    expect(addBox).not.toBeNull();
    if (addBox) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(addBox.x).toBeGreaterThanOrEqual(-1);
      expect(addBox.x + addBox.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    }

    await page.screenshot({
      path: testInfo.outputPath('plans-mobile-full.png'),
      fullPage: true,
    });

    /*
     * ПЛЮС БІЛЬШЕ НЕ ПИТАЄ «План чи подія?» — і це не спрощення тесту, а
     * рішення продукту, записане просто над кнопкою в `PlansPage.tsx`: у
     * цьому модулі плюс завжди означає план, а календарна подія
     * створюється контекстно, другим тапом по даті.
     *
     * Тест іще питав вибір і падав на заголовку «Що створюємо?».
     */
    await addButton.click();
    const createSheet = page.locator('.plan-create-sheet');
    await expect(createSheet).toBeVisible();
    await expect(createSheet.getByRole('heading', { name: 'Що хочете зробити разом?' })).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plans-create-composer.png') });

    await createSheet.getByRole('button', { name: /Обкладинка плану/ }).click();
    await expect(createSheet.locator('.plan-create-photo-picker')).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plan-create-photo-picker.png') });

    await createSheet.getByRole('button', { name: 'Скасувати' }).click();
    await expect(createSheet).toBeHidden();
  });
});
