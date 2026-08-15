import { expect, test, type Page } from '@playwright/test';
import {
  REEF_FOUNDATION_PASS,
  REEF_FOUNDATION_PRESENTATION_VERSION,
} from '../../src/features/home/reef3d/reefFoundationPresentation';
import { REEF_FISH_ROUTE_COUNT } from '../../src/features/home/reef3d/reefFishSchoolMotion';
import {
  REEF_FISH_SCHOOL_MODEL,
  REEF_FISH_SCHOOL_ROUTE_PROFILE,
  REEF_FISH_SCHOOL_SCALE,
} from '../../src/features/home/reef3d/reefFishSchoolPresentation';
import {
  REEF_MATERIAL_PASS,
  REEF_MATERIAL_PRESENTATION_VERSION,
} from '../../src/features/home/reef3d/reefMaterialPresentation';

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
    await expect(reef).toHaveAttribute('data-reef-presentation', 'reef-visual-v3');
    await expect(reef).toHaveAttribute('data-reef-shape-pass', 'phase-12-living-canopy');
    await expect(reef).toHaveAttribute(
      'data-reef-material-presentation',
      REEF_MATERIAL_PRESENTATION_VERSION,
    );
    await expect(reef).toHaveAttribute('data-reef-material-pass', REEF_MATERIAL_PASS);
    await expect(reef).toHaveAttribute(
      'data-reef-foundation-presentation',
      REEF_FOUNDATION_PRESENTATION_VERSION,
    );
    await expect(reef).toHaveAttribute('data-reef-foundation-pass', REEF_FOUNDATION_PASS);

    await expect(reef).toHaveAttribute('data-reef-fish-model', REEF_FISH_SCHOOL_MODEL, {
      timeout: 25_000,
    });
    await expect(reef).toHaveAttribute('data-reef-fish-meshes', '4');
    await expect(reef).toHaveAttribute('data-reef-fish-routes', String(REEF_FISH_ROUTE_COUNT));
    await expect(reef).toHaveAttribute(
      'data-reef-fish-animated-routes',
      String(REEF_FISH_ROUTE_COUNT),
    );
    await expect(reef).toHaveAttribute(
      'data-reef-fish-route-profile',
      REEF_FISH_SCHOOL_ROUTE_PROFILE,
    );
    await expect(reef).toHaveAttribute('data-reef-fish-scale', String(REEF_FISH_SCHOOL_SCALE));

    await expect(reef).toHaveAttribute('data-reef-structure-collision-free', 'true');
    await expect(reef).toHaveAttribute('data-reef-static-acceptance', 'pass');
    await expect(reef).toHaveAttribute('data-reef-acceptance', 'pass', { timeout: 25_000 });
    await expect(reef).toHaveAttribute('data-reef-phase-count', '8');
    await expect(reef).toHaveAttribute('data-reef-phase-order', 'true');
    await expect(reef).toHaveAttribute('data-reef-phase-provenance', 'true');
    await expect(reef).toHaveAttribute('data-reef-colony-identity', 'true');
    await expect(reef).toHaveAttribute('data-reef-range-binding-chain', 'true');
    const productionSignature = await reef.getAttribute('data-reef-production-signature');
    expect(productionSignature).toMatch(/^[0-9a-f]{8}$/);

    const reefBox = await reef.boundingBox();
    const canvasBox = await reef.locator('canvas').boundingBox();
    expect(reefBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    if (reefBox && canvasBox) {
      expect(Math.abs(canvasBox.y - reefBox.y)).toBeLessThanOrEqual(2);
      expect(canvasBox.height).toBeGreaterThanOrEqual(reefBox.height - 2);
    }

    const reefDrawCalls = Number(await reef.getAttribute('data-reef-runtime-draw-calls'));
    const reefVertices = Number(await reef.getAttribute('data-reef-vertices'));
    const reefTriangles = Number(await reef.getAttribute('data-reef-triangles'));
    const reefFishWidth = Number(await reef.getAttribute('data-reef-fish-width'));
    const reefFishHeight = Number(await reef.getAttribute('data-reef-fish-height'));
    const reefFishTracks = Number(await reef.getAttribute('data-reef-fish-tracks'));
    const reefColonies = Number(await reef.getAttribute('data-reef-colonies'));
    const reefVisibleColonies = Number(await reef.getAttribute('data-reef-visible-colonies'));
    expect(reefDrawCalls).toBeGreaterThan(0);
    expect(reefDrawCalls).toBeLessThanOrEqual(7);
    expect(reefVertices).toBeLessThanOrEqual(24_256);
    expect(reefTriangles).toBeLessThanOrEqual(36_512);
    expect(reefFishWidth).toBeGreaterThanOrEqual(2);
    expect(reefFishHeight).toBeGreaterThanOrEqual(0.5);
    expect(reefFishTracks).toBeGreaterThanOrEqual(REEF_FISH_ROUTE_COUNT * 2);
    expect(reefVisibleColonies).toBeGreaterThan(0);
    expect(reefVisibleColonies).toBeLessThanOrEqual(reefColonies);
    await page.screenshot({
      path: 'test-results/home-artifact-reef-pixel-8-pro.png',
      fullPage: true,
    });

    await page.reload();
    await expect(home).toHaveAttribute('data-home-artifact', 'reef');
    const reloadedReef = page.locator('[data-reef-preview="ready"]');
    await expect(reloadedReef).toBeVisible({ timeout: 25_000 });
    await expect(reloadedReef).toHaveAttribute('data-reef-presentation', 'reef-visual-v3');
    await expect(reloadedReef).toHaveAttribute('data-reef-shape-pass', 'phase-12-living-canopy');
    await expect(reloadedReef).toHaveAttribute(
      'data-reef-material-presentation',
      REEF_MATERIAL_PRESENTATION_VERSION,
    );
    await expect(reloadedReef).toHaveAttribute('data-reef-material-pass', REEF_MATERIAL_PASS);
    await expect(reloadedReef).toHaveAttribute(
      'data-reef-foundation-presentation',
      REEF_FOUNDATION_PRESENTATION_VERSION,
    );
    await expect(reloadedReef).toHaveAttribute('data-reef-foundation-pass', REEF_FOUNDATION_PASS);
    await expect(reloadedReef).toHaveAttribute('data-reef-fish-model', REEF_FISH_SCHOOL_MODEL, {
      timeout: 25_000,
    });
    await expect(reloadedReef).toHaveAttribute(
      'data-reef-fish-route-profile',
      REEF_FISH_SCHOOL_ROUTE_PROFILE,
    );
    await expect(reloadedReef).toHaveAttribute('data-reef-production-signature', productionSignature ?? '');
    await expect(reloadedReef).toHaveAttribute('data-reef-acceptance', 'pass', { timeout: 25_000 });
    await expect(page.getByRole('tab', { name: /Риф/ })).toHaveAttribute('aria-selected', 'true');
  });
});
