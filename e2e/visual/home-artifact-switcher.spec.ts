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
    const tree = page.locator('[data-tree-lab-preview="ready"]');
    await expect(tree).toBeVisible({ timeout: 25_000 });
    await expect(tree).toHaveAttribute('data-tree-lab-source', /portal|fixture-fallback/);
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
    await expect(reef).toHaveAttribute('data-reef-static-acceptance', 'pass');
    await expect(reef).toHaveAttribute('data-reef-acceptance', 'pass', { timeout: 25_000 });
    await expect(reef).toHaveAttribute('data-reef-phase-count', '8');
    await expect(reef).toHaveAttribute('data-reef-phase-order', 'true');
    await expect(reef).toHaveAttribute('data-reef-phase-provenance', 'true');
    await expect(reef).toHaveAttribute('data-reef-colony-identity', 'true');
    await expect(reef).toHaveAttribute('data-reef-range-binding-chain', 'true');
    const productionSignature = await reef.getAttribute('data-reef-production-signature');
    expect(productionSignature).toMatch(/^[0-9a-f]{8}$/);

    const reefDrawCalls = Number(await reef.getAttribute('data-reef-runtime-draw-calls'));
    const reefVertices = Number(await reef.getAttribute('data-reef-vertices'));
    const reefTriangles = Number(await reef.getAttribute('data-reef-triangles'));
    expect(reefDrawCalls).toBeGreaterThan(0);
    expect(reefDrawCalls).toBeLessThanOrEqual(7);
    expect(reefVertices).toBeLessThanOrEqual(24_256);
    expect(reefTriangles).toBeLessThanOrEqual(36_512);
    await page.screenshot({
      path: 'test-results/home-artifact-reef-pixel-8-pro.png',
      fullPage: true,
    });

    await page.reload();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    const reloadedReef = page.locator('[data-reef-preview="ready"]');
    await expect(reloadedReef).toBeVisible({ timeout: 25_000 });
    await expect(reloadedReef).toHaveAttribute('data-reef-production-signature', productionSignature ?? '');
    await expect(reloadedReef).toHaveAttribute('data-reef-acceptance', 'pass', { timeout: 25_000 });
    await expect(page.getByRole('tab', { name: /Риф/ })).toHaveAttribute('aria-selected', 'true');
  });
});
