import { expect, test, type Page } from '@playwright/test';

const userName = process.env.VISUAL_USER_NAME ?? '';
const userPin = process.env.VISUAL_USER_PIN ?? '';

async function login(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: userName, exact: true }).click();
  for (const digit of userPin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Home artifact switcher Pixel 8 Pro', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('switches between the accepted Crystal, Tree and Reef renderers', async ({ page }) => {
    test.slow();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page, '?artifact=crystal#/login');

    const home = page.locator('.home');
    const switcher = page.locator('[data-home-artifact-switcher="ready"]');
    await expect(home).toHaveAttribute('data-home-artifact', 'crystal');
    await expect(switcher).toBeVisible();
    await expect(page.locator('[data-evolution-preview="ready"]')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('heading', { name: 'Кристал Amore' })).toBeVisible();
    await page.screenshot({
      path: 'test-results/home-artifact-crystal-pixel-8-pro.png',
      fullPage: true,
    });

    await page.getByRole('tab', { name: 'Дерево', exact: true }).click();
    await expect(home).toHaveAttribute('data-home-artifact', 'tree');
    await expect(page.getByRole('heading', { name: 'Дерево Amore' })).toBeVisible();
    const tree = page.locator('[data-evolution-preview="ready"][data-evolution-species="tree"]');
    await expect(tree).toBeVisible({ timeout: 25_000 });
    await page.screenshot({
      path: 'test-results/home-artifact-tree-pixel-8-pro.png',
      fullPage: true,
    });

    await page.getByRole('tab', { name: /Риф/ }).click();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    await expect(page.getByRole('heading', { name: 'Риф Amore' })).toBeVisible();
    const reef = page.locator('[data-reef-preview="ready"]');
    await expect(reef).toBeVisible({ timeout: 25_000 });
    await expect(reef).toHaveAttribute('data-reef-source', 'portal');
    await expect(reef).toHaveAttribute('data-reef-phase', '6');
    await expect(reef).toHaveAttribute('data-reef-scene', 'phase-6-accretion-overlap');
    await expect(reef).toHaveAttribute('data-reef-accretion-version', 'reef-accretion-v1');
    await expect(reef).toHaveAttribute('data-reef-year-collision-free', 'true');
    await expect(reef).toHaveAttribute('data-reef-accretion-mobile-bounded', 'true');

    const reefBox = await reef.boundingBox();
    const canvas = reef.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 25_000 });
    const canvasBox = await canvas.boundingBox();
    expect(reefBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    if (reefBox && canvasBox) {
      expect(Math.abs(canvasBox.y - reefBox.y)).toBeLessThanOrEqual(2);
      expect(canvasBox.height).toBeGreaterThanOrEqual(reefBox.height - 2);
      expect(canvasBox.width).toBeGreaterThanOrEqual(reefBox.width - 2);
    }

    const accretionLayers = Number(await reef.getAttribute('data-reef-accretion-layers'));
    const visibleAccretion = Number(await reef.getAttribute('data-reef-accretion-visible'));
    const colonies = Number(await reef.getAttribute('data-reef-colonies'));
    expect(accretionLayers).toBeGreaterThan(0);
    expect(visibleAccretion).toBeGreaterThan(0);
    expect(visibleAccretion).toBeLessThanOrEqual(accretionLayers);
    expect(colonies).toBeGreaterThan(0);

    await page.waitForTimeout(1_000);
    expect(pageErrors.filter((message) => (
      message.includes('R3F:')
      || message.includes('Cannot set "data-reef')
      || message.includes('Cannot convert undefined or null to object')
    ))).toEqual([]);

    await page.screenshot({
      path: 'test-results/home-artifact-reef-pixel-8-pro.png',
      fullPage: true,
    });

    await page.reload();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    const reloadedReef = page.locator('[data-reef-preview="ready"]');
    await expect(reloadedReef).toBeVisible({ timeout: 25_000 });
    await expect(reloadedReef).toHaveAttribute('data-reef-phase', '6');
    await expect(reloadedReef).toHaveAttribute('data-reef-accretion-version', 'reef-accretion-v1');
    await expect(reloadedReef.locator('canvas')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByRole('tab', { name: /Риф/ })).toHaveAttribute('aria-selected', 'true');
  });
});
