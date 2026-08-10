import { expect, test, type Page, type Locator } from '@playwright/test';

/**
 * Приймальний статус разом із причиною в одному повідомленні.
 *
 * Окрема перевірка «немає порушень» перед «статус pass» виглядала слушно й
 * була ненадійною: поки конвеєр прогрівається, статус — «warming», а список
 * порушень порожній, тож перевірка проходила саме в ту мить і причину все
 * одно ховала. Тут статус і причина читаються разом і разом же чекають:
 * «очікували pass, дістали fail build-ms» — це вже готова відповідь, а не
 * привід іти в логи збірки.
 */
async function expectTreeAcceptancePass(preview: Locator, timeout = 20_000) {
  await expect(async () => {
    const status = await preview.getAttribute('data-tree-lab-acceptance');
    const violations = await preview.getAttribute('data-tree-lab-violations');
    expect(`${status ?? '—'} ${violations ?? ''}`.trim()).toBe('pass');
  }).toPass({ timeout });
}


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

test.describe('Tree Soil Surface Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders quantized terrain tint through the shared bark material', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);
    await expect(preview).toHaveAttribute('data-tree-lab-soil-surface', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-id', 'tree:soil:surface');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-palette-id', 'tree:soil:palette');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-tint-attribute', 'tree:soil:vertex-tint');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-terrain-surface-id', 'tree:terrain:surface');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-material-role', 'bark');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-prefix-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-terrain-range-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-soil-tint-budget-exceeded', 'false');

    const rootGeometryVertices = numeric(
      await preview.getAttribute('data-tree-lab-soil-root-geometry-vertices'),
      'rootGeometryVertices',
    );
    const prefixVertices = numeric(
      await preview.getAttribute('data-tree-lab-soil-prefix-vertices'),
      'prefixVertices',
    );
    const terrainOffset = numeric(
      await preview.getAttribute('data-tree-lab-soil-terrain-offset'),
      'terrainOffset',
    );
    const terrainVertices = numeric(
      await preview.getAttribute('data-tree-lab-soil-terrain-vertices'),
      'terrainVertices',
    );
    const tintedVertices = numeric(
      await preview.getAttribute('data-tree-lab-soil-tinted-vertices'),
      'tintedVertices',
    );
    const uniqueTints = numeric(
      await preview.getAttribute('data-tree-lab-soil-unique-tints'),
      'uniqueTints',
    );
    const tintBudget = numeric(
      await preview.getAttribute('data-tree-lab-soil-tint-budget'),
      'tintBudget',
    );
    const quantization = numeric(
      await preview.getAttribute('data-tree-lab-soil-quantization'),
      'quantization',
    );
    const radialBands = numeric(
      await preview.getAttribute('data-tree-lab-soil-radial-bands'),
      'radialBands',
    );
    const variationBands = numeric(
      await preview.getAttribute('data-tree-lab-soil-variation-bands'),
      'variationBands',
    );
    const soilMaterialCount = numeric(
      await preview.getAttribute('data-tree-lab-soil-material-count'),
      'soilMaterialCount',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-soil-extra-draw-calls'),
      'soilExtraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-soil-extra-materials'),
      'soilExtraMaterials',
    );
    const materialCount = numeric(
      await preview.getAttribute('data-tree-lab-material-count'),
      'materialCount',
    );
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');
    const signature = await preview.getAttribute('data-tree-lab-soil-signature');

    expect(prefixVertices).toBe(terrainOffset);
    expect(prefixVertices + terrainVertices).toBe(rootGeometryVertices);
    expect(tintedVertices).toBe(terrainVertices);
    expect(uniqueTints).toBeGreaterThan(1);
    expect(uniqueTints).toBeLessThanOrEqual(tintBudget);
    expect(radialBands * variationBands).toBeLessThanOrEqual(tintBudget);
    expect(quantization).toBe(16);
    expect(soilMaterialCount).toBe(2);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(materialCount).toBe(2);
    expect(drawCalls).toBeLessThanOrEqual(4);
    expect(signature?.length ?? 0).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/tree-soil-surface-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
