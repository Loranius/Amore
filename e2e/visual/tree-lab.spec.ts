import { expect, test } from '@playwright/test';

const userName = process.env.VISUAL_USER_NAME ?? '';
const userPin = process.env.VISUAL_USER_PIN ?? '';

test.describe('Tree Lab Pixel 8 Pro preview', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders the medium LOD and passes the mobile budget', async ({ page }) => {
    await page.goto('?engine=tree-lab&treeLod=medium#/login');
    await page.getByRole('button', { name: userName, exact: true }).click();

    for (const digit of userPin) {
      await page.getByRole('button', { name: digit, exact: true }).click();
    }

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-lod', 'medium');
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', {
      timeout: 20_000,
    });
    await expect(preview).toHaveAttribute('data-tree-lab-violations', '');

    await page.screenshot({
      path: 'test-results/tree-lab-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
