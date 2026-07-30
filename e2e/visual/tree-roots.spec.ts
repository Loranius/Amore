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

test.describe('Tree Root Geometry Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders a bounded anchored root sweep outside Tree Life deformation', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass', { timeout: 20_000 });

    const candidates = numeric(await preview.getAttribute('data-tree-lab-root-candidates'), 'rootCandidates');
    const roots = numeric(await preview.getAttribute('data-tree-lab-root-count'), 'rootCount');
    const surface = numeric(await preview.getAttribute('data-tree-lab-root-surface'), 'surfaceRoots');
    const nearSurface = numeric(
      await preview.getAttribute('data-tree-lab-root-near-surface'),
      'nearSurfaceRoots',
    );
    const samples = numeric(await preview.getAttribute('data-tree-lab-root-samples'), 'rootSamples');
    const truncated = numeric(await preview.getAttribute('data-tree-lab-root-truncated'), 'rootTruncated');
    const rootBudget = numeric(await preview.getAttribute('data-tree-lab-root-budget'), 'rootBudget');
    const sampleBudget = numeric(
      await preview.getAttribute('data-tree-lab-root-sample-budget'),
      'rootSampleBudget',
    );
    const renderedRoots = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-roots'),
      'renderedRoots',
    );
    const rootVertices = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-vertices'),
      'rootVertices',
    );
    const rootTriangles = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-triangles'),
      'rootTriangles',
    );
    const rootDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-draw-calls'),
      'rootDrawCalls',
    );
    const vertexBudget = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-vertex-budget'),
      'rootVertexBudget',
    );
    const triangleBudget = numeric(
      await preview.getAttribute('data-tree-lab-root-geometry-triangle-budget'),
      'rootTriangleBudget',
    );
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');

    expect(candidates).toBeGreaterThanOrEqual(roots);
    expect(roots).toBeGreaterThanOrEqual(3);
    expect(roots).toBeLessThanOrEqual(9);
    expect(surface + nearSurface).toBe(roots);
    expect(samples).toBe(roots * 7);
    expect(samples).toBeLessThanOrEqual(63);
    expect(truncated).toBeGreaterThanOrEqual(0);
    expect(rootBudget).toBe(9);
    expect(sampleBudget).toBe(63);
    expect(renderedRoots).toBe(roots);
    expect(rootVertices).toBeGreaterThan(0);
    expect(rootVertices).toBeLessThanOrEqual(vertexBudget);
    expect(rootTriangles).toBeGreaterThan(0);
    expect(rootTriangles).toBeLessThanOrEqual(triangleBudget);
    expect(rootDrawCalls).toBe(1);
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-anchored', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-vertex-budget-exceeded', 'false');
    await expect(preview).toHaveAttribute('data-tree-lab-root-geometry-triangle-budget-exceeded', 'false');
    expect(drawCalls).toBeLessThanOrEqual(4);

    await page.screenshot({
      path: 'test-results/tree-root-geometry-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
