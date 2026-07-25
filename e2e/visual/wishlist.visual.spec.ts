import { expect, test } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Parameters<typeof test>[0] extends never ? never : any, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Amore mobile visual preview', () => {
  test('captures login and authenticated wishlist', async ({ page }, testInfo) => {
    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('01-login-mobile.png'),
      fullPage: true,
    });

    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description:
          'Authenticated wishlist capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/wishlist', { waitUntil: 'networkidle' });

    const wishlist = page.locator('.wishlist');
    await expect(wishlist).toBeVisible();

    const grid = page.locator('.wishlist-grid');
    await expect(grid).toBeVisible();
    await grid.scrollIntoViewIfNeeded();

    // Let images and layout settle while reduced-motion keeps the capture stable.
    await page.waitForTimeout(1_200);

    await page.screenshot({
      path: testInfo.outputPath('02-wishlist-mobile-full.png'),
      fullPage: true,
    });

    await grid.screenshot({
      path: testInfo.outputPath('03-wishlist-bubbles.png'),
    });
  });
});
