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

test.describe('Tree Terrain Binding Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders a bounded heightfield merged into the anchored root mesh', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', { timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-binding', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-binding-id', 'tree:terrain:binding');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-source-binding', 'tree:terrain:future');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-surface-id', 'tree:terrain:surface');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-heightfield-id', 'tree:terrain:heightfield');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-ground-plane-id', 'tree:ground:contact-plane');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-ground-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-root-coverage-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-terrain-merged', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-terrain-applied', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-terrain-merged', 'true');

    const contactGroundLevel = numeric(
      await preview.getAttribute('data-tree-lab-ground-level'),
      'contactGroundLevel',
    );
    const terrainGroundLevel = numeric(
      await preview.getAttribute('data-tree-lab-terrain-ground-level'),
      'terrainGroundLevel',
    );
    const surfaceRadius = numeric(
      await preview.getAttribute('data-tree-lab-terrain-surface-radius'),
      'surfaceRadius',
    );
    const plateauRadius = numeric(
      await preview.getAttribute('data-tree-lab-terrain-plateau-radius'),
      'plateauRadius',
    );
    const rootCoverageRadius = numeric(
      await preview.getAttribute('data-tree-lab-terrain-root-coverage-radius'),
      'rootCoverageRadius',
    );
    const vertices = numeric(
      await preview.getAttribute('data-tree-lab-terrain-vertices'),
      'terrainVertices',
    );
    const triangles = numeric(
      await preview.getAttribute('data-tree-lab-terrain-triangles'),
      'terrainTriangles',
    );
    const vertexBudget = numeric(
      await preview.getAttribute('data-tree-lab-terrain-vertex-budget'),
      'terrainVertexBudget',
    );
    const triangleBudget = numeric(
      await preview.getAttribute('data-tree-lab-terrain-triangle-budget'),
      'terrainTriangleBudget',
    );
    const maximumHeightDelta = numeric(
      await preview.getAttribute('data-tree-lab-terrain-max-height-delta'),
      'maximumHeightDelta',
    );
    const mergedVertices = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-terrain-vertices'),
      'mergedTerrainVertices',
    );
    const mergedTriangles = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-terrain-triangles'),
      'mergedTerrainTriangles',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-terrain-extra-draw-calls'),
      'terrainExtraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-terrain-extra-materials'),
      'terrainExtraMaterials',
    );
    const materialCount = numeric(
      await preview.getAttribute('data-tree-lab-material-count'),
      'materialCount',
    );
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');

    expect(terrainGroundLevel).toBeCloseTo(contactGroundLevel, 6);
    expect(surfaceRadius).toBeGreaterThan(plateauRadius);
    expect(plateauRadius).toBeGreaterThanOrEqual(rootCoverageRadius);
    expect(vertices).toBeGreaterThan(0);
    expect(vertices).toBeLessThanOrEqual(vertexBudget);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(triangleBudget);
    expect(maximumHeightDelta).toBeGreaterThan(0);
    expect(mergedVertices).toBe(vertices);
    expect(mergedTriangles).toBe(triangles);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(materialCount).toBe(2);
    expect(drawCalls).toBeLessThanOrEqual(3);

    await page.screenshot({
      path: 'test-results/tree-terrain-binding-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
