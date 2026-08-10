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

test.describe('Tree Canopy Light Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders stable crown-side light response in the existing leaf draw call', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light', 'true');
    await expect(preview).toHaveAttribute(
      'data-tree-lab-canopy-light-id',
      'tree:canopy-light:response',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-canopy-light-profile-id',
      'tree:canopy-light:instance-profile',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-canopy-light-tint-attribute',
      'tree:canopy-light:instance-tint',
    );
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light-direction-normalized', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light-order-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light-instances-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light-cells-preserved', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-canopy-light-tint-budget-exceeded', 'false');

    const leaves = numeric(await preview.getAttribute('data-tree-lab-leaf-instances'), 'leaves');
    const profiles = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-profiles'),
      'profiles',
    );
    const shade = numeric(await preview.getAttribute('data-tree-lab-canopy-light-shade'), 'shade');
    const transition = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-transition'),
      'transition',
    );
    const sunlit = numeric(await preview.getAttribute('data-tree-lab-canopy-light-sunlit'), 'sunlit');
    const exposureMin = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-exposure-min'),
      'exposureMin',
    );
    const exposureMax = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-exposure-max'),
      'exposureMax',
    );
    const exposureAverage = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-exposure-average'),
      'exposureAverage',
    );
    const uniqueTints = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-unique-tints'),
      'uniqueTints',
    );
    const tintBudget = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-tint-budget'),
      'tintBudget',
    );
    const extraDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-extra-draw-calls'),
      'extraDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-extra-materials'),
      'extraMaterials',
    );
    const extraMatrixUpdates = numeric(
      await preview.getAttribute('data-tree-lab-canopy-light-extra-matrix-updates'),
      'extraMatrixUpdates',
    );
    const totalDrawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');

    expect(profiles).toBe(leaves);
    expect(shade + transition + sunlit).toBe(leaves);
    expect([shade, transition, sunlit].filter((count) => count > 0).length).toBeGreaterThanOrEqual(2);
    expect(exposureMin).toBeGreaterThanOrEqual(0);
    expect(exposureMax).toBeLessThanOrEqual(1);
    expect(exposureMax).toBeGreaterThan(exposureMin);
    expect(exposureAverage).toBeGreaterThanOrEqual(exposureMin);
    expect(exposureAverage).toBeLessThanOrEqual(exposureMax);
    expect(uniqueTints).toBeGreaterThan(1);
    expect(uniqueTints).toBeLessThanOrEqual(tintBudget);
    expect(extraDrawCalls).toBe(0);
    expect(extraMaterials).toBe(0);
    expect(extraMatrixUpdates).toBe(0);
    expect(totalDrawCalls).toBeLessThanOrEqual(4);

    await page.screenshot({
      path: 'test-results/tree-canopy-light-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
