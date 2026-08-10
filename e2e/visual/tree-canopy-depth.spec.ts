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

test.describe('Tree Canopy Depth Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders stable inner, middle and outer crown layers in the existing leaf draw call', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-depth', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-depth-id', 'tree:canopy-depth:volume');
    await expect(preview).toHaveAttribute(
      'data-tree-lab-canopy-profile-id',
      'tree:canopy-depth:instance-profile',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-canopy-tint-attribute',
      'tree:canopy-depth:instance-tint',
    );
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-cells-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-empty-cells-filled', 'false');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-order-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-instances-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-tint-budget-exceeded', 'false');

    const leaves = numeric(await preview.getAttribute('data-tree-lab-leaf-instances'), 'leaves');
    const profiles = numeric(await preview.getAttribute('data-tree-lab-canopy-profiles'), 'profiles');
    const inner = numeric(await preview.getAttribute('data-tree-lab-canopy-inner'), 'inner');
    const middle = numeric(await preview.getAttribute('data-tree-lab-canopy-middle'), 'middle');
    const outer = numeric(await preview.getAttribute('data-tree-lab-canopy-outer'), 'outer');
    const scaleMin = numeric(await preview.getAttribute('data-tree-lab-canopy-scale-min'), 'scaleMin');
    const scaleMax = numeric(await preview.getAttribute('data-tree-lab-canopy-scale-max'), 'scaleMax');
    const maxOffset = numeric(await preview.getAttribute('data-tree-lab-canopy-max-offset'), 'maxOffset');
    const maxOffsetRatio = numeric(
      await preview.getAttribute('data-tree-lab-canopy-max-offset-ratio'),
      'maxOffsetRatio',
    );
    const uniqueTints = numeric(
      await preview.getAttribute('data-tree-lab-canopy-unique-tints'),
      'uniqueTints',
    );
    const tintBudget = numeric(
      await preview.getAttribute('data-tree-lab-canopy-tint-budget'),
      'tintBudget',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-canopy-extra-draw-calls'),
      'extraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-canopy-extra-materials'),
      'extraMaterials',
    );
    const extraMatrixUpdates = numeric(
      await preview.getAttribute('data-tree-lab-canopy-extra-matrix-updates'),
      'extraMatrixUpdates',
    );
    const totalDrawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');

    expect(profiles).toBe(leaves);
    expect(inner).toBeGreaterThan(0);
    expect(middle).toBeGreaterThan(0);
    expect(outer).toBeGreaterThan(0);
    expect(inner + middle + outer).toBe(leaves);
    expect(scaleMin).toBeGreaterThan(0);
    expect(scaleMax).toBeGreaterThan(scaleMin);
    expect(maxOffset).toBeGreaterThan(0);
    expect(maxOffsetRatio).toBeGreaterThan(0);
    expect(maxOffsetRatio).toBeLessThanOrEqual(0.25);
    expect(uniqueTints).toBeGreaterThan(1);
    expect(uniqueTints).toBeLessThanOrEqual(tintBudget);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(extraMatrixUpdates).toBe(0);
    expect(totalDrawCalls).toBeLessThanOrEqual(4);

    await page.screenshot({
      path: 'test-results/tree-canopy-depth-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
