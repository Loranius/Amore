import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
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

    // Let images and layout settle while reduced-motion keeps the capture stable.
    await page.waitForTimeout(1_200);

    await page.screenshot({
      path: testInfo.outputPath('02-wishlist-mobile-full.png'),
      fullPage: true,
    });

    const controls = page.locator('.wl-wishlist-controls');
    await expect(controls).toBeVisible();
    await controls.screenshot({
      path: testInfo.outputPath('03-wishlist-controls-collapsed.png'),
    });

    const priorityToggle = page.locator('.wl-board-toolbar-toggle');
    if (await priorityToggle.isVisible()) {
      await priorityToggle.click();
      await expect(page.locator('.wl-board-toolbar-panel')).toBeVisible();
      await controls.screenshot({
        path: testInfo.outputPath('04-wishlist-controls-expanded.png'),
      });
      await priorityToggle.click();
    }

    const grid = page.locator('.wishlist-grid');
    await expect(grid).toBeVisible();
    await grid.scrollIntoViewIfNeeded();

    const firstBubbleItem = page.locator('.wl-cloud-item').first();
    if (await firstBubbleItem.count()) {
      const pseudoMotion = await firstBubbleItem.evaluate((item) => {
        const bubble = item.querySelector<HTMLElement>('.wl-cloud-bubble');
        if (!bubble) throw new Error('Wishlist bubble was not found.');

        const itemBefore = getComputedStyle(item, '::before');
        const itemAfter = getComputedStyle(item, '::after');
        const bubbleBefore = getComputedStyle(bubble, '::before');

        return {
          itemBeforeDisplay: itemBefore.display,
          itemBeforeAnimation: itemBefore.animationName,
          itemAfterDisplay: itemAfter.display,
          itemAfterAnimation: itemAfter.animationName,
          bubbleBeforeAnimation: bubbleBefore.animationName,
        };
      });

      expect(pseudoMotion).toEqual({
        itemBeforeDisplay: 'none',
        itemBeforeAnimation: 'none',
        itemAfterDisplay: 'none',
        itemAfterAnimation: 'none',
        bubbleBeforeAnimation: 'none',
      });
    }

    await grid.screenshot({
      path: testInfo.outputPath('05-wishlist-bubbles.png'),
    });
  });
});
