import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Shopping mobile visual preview', () => {
  test('captures the shopping list UI', async ({ page }, testInfo) => {
    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'Shopping capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();
    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/shopping', { waitUntil: 'networkidle' });

    const shopping = page.locator('.shopping-page');
    await expect(shopping).toBeVisible();
    await page.waitForTimeout(800);

    await page.screenshot({
      path: testInfo.outputPath('shopping-mobile-full.png'),
      fullPage: true,
    });

    await page.locator('.shopping-hero').screenshot({
      path: testInfo.outputPath('shopping-hero.png'),
    });

    await page.locator('.shopping-composer').screenshot({
      path: testInfo.outputPath('shopping-composer.png'),
    });

    const firstGroup = page.locator('.shopping-group').first();
    if (await firstGroup.count()) {
      await firstGroup.screenshot({ path: testInfo.outputPath('shopping-category-group.png') });
    }
  });
});
