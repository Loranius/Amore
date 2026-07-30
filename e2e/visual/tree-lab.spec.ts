import { expect, test, type Locator, type Page } from '@playwright/test';

const userName = process.env.VISUAL_USER_NAME ?? '';
const userPin = process.env.VISUAL_USER_PIN ?? '';
const MAX_FOLIAGE_CLUSTERS = 64;
const MAX_FOLIAGE_LEAVES = 900;
const MAX_MEDIUM_LEAF_INSTANCES = 720;
const MAX_MEDIUM_LIFE_PROFILES = 520;
const MAX_TREE_TRIANGLES = 16_000;
const MAX_TREE_DRAW_CALLS = 4;
const TREE_MATERIAL_COUNT = 2;
const TREE_MATERIAL_QUANTIZATION = 16;

async function login(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: userName, exact: true }).click();

  for (const digit of userPin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

function numericAttribute(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be finite, received ${String(value)}`);
  return parsed;
}

async function expectCompositionMetrics(preview: Locator) {
  await expect(preview).toHaveAttribute(
    'data-tree-lab-silhouette',
    /^(columnar|oval|umbrella|windswept)$/,
  );
  for (const attribute of [
    'data-tree-lab-composition-score',
    'data-tree-lab-negative-space',
    'data-tree-lab-crown-density',
  ]) {
    const value = numericAttribute(await preview.getAttribute(attribute), attribute);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(1);
  }
  expect(numericAttribute(
    await preview.getAttribute('data-tree-lab-empty-cells'),
    'emptyCells',
  )).toBeGreaterThanOrEqual(0);
}

async function expectFoliageMetrics(preview: Locator, requireClusters: boolean) {
  const candidates = numericAttribute(
    await preview.getAttribute('data-tree-lab-foliage-candidates'),
    'foliageCandidates',
  );
  const clusters = numericAttribute(
    await preview.getAttribute('data-tree-lab-foliage-clusters'),
    'foliageClusters',
  );
  const leaves = numericAttribute(
    await preview.getAttribute('data-tree-lab-foliage-leaves'),
    'foliageLeaves',
  );
  const cells = numericAttribute(
    await preview.getAttribute('data-tree-lab-foliage-cells'),
    'foliageCells',
  );
  const truncated = numericAttribute(
    await preview.getAttribute('data-tree-lab-foliage-truncated'),
    'foliageTruncated',
  );

  expect(candidates).toBeGreaterThanOrEqual(clusters);
  expect(clusters).toBeGreaterThanOrEqual(requireClusters ? 1 : 0);
  expect(clusters).toBeLessThanOrEqual(MAX_FOLIAGE_CLUSTERS);
  expect(leaves).toBeGreaterThanOrEqual(0);
  expect(leaves).toBeLessThanOrEqual(MAX_FOLIAGE_LEAVES);
  expect(cells).toBeGreaterThanOrEqual(0);
  expect(truncated).toBeGreaterThanOrEqual(0);
}

async function expectLeafGeometryMetrics(preview: Locator, requireInstances: boolean) {
  const candidates = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-candidates'),
    'leafCandidates',
  );
  const instances = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-instances'),
    'leafInstances',
  );
  const sharedVertices = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-shared-vertices'),
    'leafSharedVertices',
  );
  const sharedTriangles = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-shared-triangles'),
    'leafSharedTriangles',
  );
  const renderedTriangles = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-rendered-triangles'),
    'leafRenderedTriangles',
  );
  const truncated = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-truncated'),
    'leafTruncated',
  );
  const estimatedDrawCalls = numericAttribute(
    await preview.getAttribute('data-tree-lab-leaf-draw-calls'),
    'leafDrawCalls',
  );

  expect(candidates).toBeGreaterThanOrEqual(instances);
  expect(instances).toBeGreaterThanOrEqual(requireInstances ? 1 : 0);
  expect(instances).toBeLessThanOrEqual(MAX_MEDIUM_LEAF_INSTANCES);
  expect(sharedVertices).toBeGreaterThan(0);
  expect(sharedTriangles).toBeGreaterThan(0);
  expect(renderedTriangles).toBe(instances * sharedTriangles);
  expect(truncated).toBeGreaterThanOrEqual(0);
  expect(estimatedDrawCalls).toBe(1);
}

async function expectMaterialMetrics(preview: Locator) {
  expect(numericAttribute(
    await preview.getAttribute('data-tree-lab-material-count'),
    'treeMaterialCount',
  )).toBe(TREE_MATERIAL_COUNT);
  expect(numericAttribute(
    await preview.getAttribute('data-tree-lab-material-budget'),
    'treeMaterialBudget',
  )).toBe(TREE_MATERIAL_COUNT);
  expect(numericAttribute(
    await preview.getAttribute('data-tree-lab-material-quantization'),
    'treeMaterialQuantization',
  )).toBe(TREE_MATERIAL_QUANTIZATION);
  await expect(preview).toHaveAttribute('data-tree-lab-material-budget-exceeded', 'false');
  await expect(preview).toHaveAttribute('data-tree-lab-bark-material', /tree-material-v1\.0\.0\|bark\|/);
  await expect(preview).toHaveAttribute('data-tree-lab-foliage-material', /tree-material-v1\.0\.0\|foliage\|/);
}

async function expectLifeMetrics(preview: Locator, requireProfiles: boolean) {
  const profiles = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-profiles'),
    'treeLifeProfiles',
  );
  const truncated = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-truncated'),
    'treeLifeTruncated',
  );
  const motionScale = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-motion-scale'),
    'treeLifeMotionScale',
  );
  const swayX = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-sway-x'),
    'treeLifeSwayX',
  );
  const swayZ = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-sway-z'),
    'treeLifeSwayZ',
  );
  const matrixUpdates = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-matrix-updates'),
    'treeLifeMatrixUpdates',
  );
  const extraDrawCalls = numericAttribute(
    await preview.getAttribute('data-tree-lab-life-extra-draw-calls'),
    'treeLifeExtraDrawCalls',
  );

  expect(profiles).toBeGreaterThanOrEqual(requireProfiles ? 1 : 0);
  expect(profiles).toBeLessThanOrEqual(MAX_MEDIUM_LIFE_PROFILES);
  expect(truncated).toBeGreaterThanOrEqual(0);
  expect(motionScale).toBeGreaterThan(0);
  expect(motionScale).toBeLessThanOrEqual(1);
  expect(swayX).toBeGreaterThan(0);
  expect(swayZ).toBeGreaterThan(0);
  expect(matrixUpdates).toBe(profiles);
  expect(extraDrawCalls).toBe(0);
  await expect(preview).toHaveAttribute('data-tree-lab-life-reduced-motion', 'false');
}

async function expectRuntimeBudget(preview: Locator) {
  const triangles = numericAttribute(
    await preview.getAttribute('data-tree-lab-triangles'),
    'treeTriangles',
  );
  const drawCalls = numericAttribute(
    await preview.getAttribute('data-tree-lab-draw-calls'),
    'treeDrawCalls',
  );

  expect(triangles).toBeGreaterThan(0);
  expect(triangles).toBeLessThanOrEqual(MAX_TREE_TRIANGLES);
  expect(drawCalls).toBeGreaterThan(0);
  expect(drawCalls).toBeLessThanOrEqual(MAX_TREE_DRAW_CALLS);
}

test.describe('Tree Species Pixel 8 Pro preview', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('keeps the deterministic fixture baseline inside the mobile budget', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-source', 'fixture');
    await expect(preview).toHaveAttribute('data-tree-lab-lod', 'medium');
    await expect(preview).toHaveAttribute('data-tree-lab-stage', 'young');
    await expect(preview).toHaveAttribute('data-tree-lab-annual-instructions', '2');
    await expect(preview).toHaveAttribute('data-tree-lab-event-instructions', '8');
    await expect(preview).toHaveAttribute('data-tree-lab-normalized-events', '8');
    await expect(preview).toHaveAttribute('data-tree-lab-attractors', '15');
    await expect(preview).toHaveAttribute('data-tree-lab-truncated', '0');
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', {
      timeout: 20_000,
    });
    await expect(preview).toHaveAttribute('data-tree-lab-violations', '');
    await expectCompositionMetrics(preview);
    await expectFoliageMetrics(preview, true);
    await expectLeafGeometryMetrics(preview, true);
    await expectMaterialMetrics(preview);
    await expectLifeMetrics(preview, true);
    await expectRuntimeBudget(preview);

    await page.screenshot({
      path: 'test-results/tree-species-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });

  test('adapts normalized real portal history without changing production Home', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=portal&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-source', 'portal');
    await expect(preview).toHaveAttribute('data-tree-lab-error', '');
    await expect(preview).toHaveAttribute('data-tree-lab-couple-id', /^amore-couple:\d+(?:-\d+)*$/);
    await expect(preview).toHaveAttribute('data-tree-lab-lod', 'medium');
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', {
      timeout: 20_000,
    });
    await expectCompositionMetrics(preview);
    await expectFoliageMetrics(preview, false);
    await expectLeafGeometryMetrics(preview, false);
    await expectMaterialMetrics(preview);
    await expectLifeMetrics(preview, false);
    await expectRuntimeBudget(preview);

    const normalizedEvents = numericAttribute(
      await preview.getAttribute('data-tree-lab-normalized-events'),
      'normalizedEvents',
    );
    const branches = numericAttribute(
      await preview.getAttribute('data-tree-lab-branches'),
      'branches',
    );
    const attractors = numericAttribute(
      await preview.getAttribute('data-tree-lab-attractors'),
      'attractors',
    );

    expect(normalizedEvents).toBeGreaterThanOrEqual(0);
    expect(branches).toBeGreaterThan(0);
    expect(attractors).toBeGreaterThanOrEqual(0);

    await page.screenshot({
      path: 'test-results/tree-species-portal-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
