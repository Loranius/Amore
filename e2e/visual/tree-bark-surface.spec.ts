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

test.describe('Tree Bark Surface Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders deterministic age cues and procedural bark roughness without new draw calls', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);
    await expect(preview).toHaveAttribute('data-tree-lab-bark-surface', 'true');
    await expect(preview).toHaveAttribute(
      'data-tree-lab-bark-surface-id',
      'tree:bark:surface-character',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-bark-tint-attribute',
      'tree:bark:vertex-tint',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-bark-roughness-attribute',
      'tree:bark:roughness-character',
    );
    await expect(preview).toHaveAttribute('data-tree-lab-bark-tint-budget-exceeded', 'false');
    await expect(preview).toHaveAttribute('data-tree-lab-bark-geometry-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-bark-ranges-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-bark-soil-preserved', 'true');

    const branchVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-branch-vertices'),
      'branchVertices',
    );
    const tintedBranchVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-tinted-branch-vertices'),
      'tintedBranchVertices',
    );
    const staticVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-static-vertices'),
      'staticVertices',
    );
    const staticBarkVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-static-bark-vertices'),
      'staticBarkVertices',
    );
    const terrainVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-terrain-vertices'),
      'terrainVertices',
    );
    const trunkVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-trunk-vertices'),
      'trunkVertices',
    );
    const generatedVertices = numeric(
      await preview.getAttribute('data-tree-lab-bark-generated-vertices'),
      'generatedVertices',
    );
    const uniqueTints = numeric(
      await preview.getAttribute('data-tree-lab-bark-unique-tints'),
      'uniqueTints',
    );
    const tintBudget = numeric(
      await preview.getAttribute('data-tree-lab-bark-tint-budget'),
      'tintBudget',
    );
    const roughnessMin = numeric(
      await preview.getAttribute('data-tree-lab-bark-roughness-min'),
      'roughnessMin',
    );
    const roughnessMax = numeric(
      await preview.getAttribute('data-tree-lab-bark-roughness-max'),
      'roughnessMax',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-bark-extra-draw-calls'),
      'extraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-bark-extra-materials'),
      'extraMaterials',
    );
    const totalDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-draw-calls'),
      'totalDrawCalls',
    );

    expect(branchVertices).toBeGreaterThan(0);
    expect(tintedBranchVertices).toBe(branchVertices);
    expect(staticVertices).toBe(staticBarkVertices + terrainVertices);
    expect(trunkVertices).toBeGreaterThan(0);
    expect(generatedVertices).toBeGreaterThan(0);
    expect(trunkVertices + generatedVertices).toBe(branchVertices);
    expect(uniqueTints).toBeGreaterThan(1);
    expect(uniqueTints).toBeLessThanOrEqual(tintBudget);
    expect(roughnessMin).toBeGreaterThanOrEqual(0);
    expect(roughnessMax).toBeLessThanOrEqual(1);
    expect(roughnessMax).toBeGreaterThan(roughnessMin);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(totalDrawCalls).toBeLessThanOrEqual(4);

    await page.screenshot({
      path: 'test-results/tree-bark-surface-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
