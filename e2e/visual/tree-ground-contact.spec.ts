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

function numeric(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be finite, received ${String(value)}`);
  return parsed;
}

test.describe('Tree Ground Contact Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('publishes grounded visible root prefixes and a merged trunk collar', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', { timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-ground-contact', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-ground-prefix-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-ground-terrain-binding', 'tree:terrain:future');
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-contact-applied', 'true');

    const roots = numeric(await preview.getAttribute('data-tree-lab-root-count'), 'roots');
    const sourceSamples = numeric(await preview.getAttribute('data-tree-lab-root-samples'), 'sourceSamples');
    const visibleRoots = numeric(
      await preview.getAttribute('data-tree-lab-ground-visible-roots'),
      'visibleRoots',
    );
    const visibleSamples = numeric(
      await preview.getAttribute('data-tree-lab-ground-visible-samples'),
      'visibleSamples',
    );
    const buriedSamples = numeric(
      await preview.getAttribute('data-tree-lab-ground-buried-samples'),
      'buriedSamples',
    );
    const visibleFraction = numeric(
      await preview.getAttribute('data-tree-lab-ground-visible-path-fraction'),
      'visibleFraction',
    );
    const burialDepth = numeric(
      await preview.getAttribute('data-tree-lab-ground-burial-depth'),
      'burialDepth',
    );
    const groundLevel = numeric(
      await preview.getAttribute('data-tree-lab-ground-level'),
      'groundLevel',
    );
    const collarBottomY = numeric(
      await preview.getAttribute('data-tree-lab-ground-collar-bottom-y'),
      'collarBottomY',
    );
    const collarTopY = numeric(
      await preview.getAttribute('data-tree-lab-ground-collar-top-y'),
      'collarTopY',
    );
    const collarBottomRadius = numeric(
      await preview.getAttribute('data-tree-lab-ground-collar-bottom-radius'),
      'collarBottomRadius',
    );
    const collarTopRadius = numeric(
      await preview.getAttribute('data-tree-lab-ground-collar-top-radius'),
      'collarTopRadius',
    );
    const collarVertices = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-collar-vertices'),
      'collarVertices',
    );
    const collarTriangles = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-collar-triangles'),
      'collarTriangles',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-ground-extra-draw-calls'),
      'extraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-ground-extra-materials'),
      'extraMaterials',
    );
    const materialCount = numeric(
      await preview.getAttribute('data-tree-lab-material-count'),
      'materialCount',
    );
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');

    expect(visibleRoots).toBe(roots);
    expect(visibleSamples).toBeGreaterThanOrEqual(roots * 2);
    expect(visibleSamples).toBeLessThan(sourceSamples);
    expect(buriedSamples).toBeGreaterThan(0);
    expect(visibleFraction).toBeGreaterThan(0);
    expect(visibleFraction).toBeLessThan(1);
    expect(burialDepth).toBeGreaterThan(0);
    expect(collarBottomY).toBeCloseTo(groundLevel, 6);
    expect(collarTopY).toBeGreaterThan(collarBottomY);
    expect(collarBottomRadius).toBeGreaterThan(collarTopRadius);
    expect(collarVertices).toBeGreaterThan(0);
    expect(collarTriangles).toBeGreaterThan(0);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(materialCount).toBe(2);
    expect(drawCalls).toBeLessThanOrEqual(3);

    await page.screenshot({
      path: 'test-results/tree-ground-contact-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
