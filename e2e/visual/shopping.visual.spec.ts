import { expect, test } from '@playwright/test';
import { hasVisualCredentials, loginByEmail } from './emailLogin';

test.describe('Shopping mobile visual preview', () => {
  test('captures the shopping list UI', async ({ page }, testInfo) => {
    if (!hasVisualCredentials) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'Shopping capture skipped. Add VISUAL_USER_EMAIL and VISUAL_USER_PASSWORD repository secrets.',
      });
      return;
    }

    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();
    await loginByEmail(page);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/shopping', { waitUntil: 'networkidle' });

    const shopping = page.locator('.shopping-page');
    await expect(shopping).toBeVisible();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: testInfo.outputPath('shopping-mobile-full.png'),
      fullPage: true,
    });

    /*
     * ТУТ СТОЯЛИ `.shopping-hero` І `.shopping-composer`. Обох немає:
     * шапку модуля робить спільний `PageHeader`, а поле вводу живе в
     * доці внизу екрана (`.shopping-dock`), куди воно й переїхало разом
     * із полицею шаблонів.
     *
     * Тест чекав на `.shopping-hero` дві хвилини й падав по таймауту —
     * тобто модуль півтора місяця не мав жодного знімка в CI.
     */
    await page.locator('.shopping-page .page-head').screenshot({
      path: testInfo.outputPath('shopping-header.png'),
    });

    const dock = page.locator('.shopping-dock');
    await expect(dock).toBeVisible();
    await dock.screenshot({
      path: testInfo.outputPath('shopping-dock.png'),
    });

    const firstGroup = page.locator('.shopping-group').first();
    if (await firstGroup.count()) {
      await firstGroup.screenshot({ path: testInfo.outputPath('shopping-category-group.png') });
    }
  });
});
