import { expect, test, type Page, type Locator } from '@playwright/test';
import { DEFAULT_TREE_GROUND_DETAIL_CONFIG } from '../../src/engine/groundDetail/config';

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


// Очікувані числа беруться з опублікованої конфігурації, а не пишуться тут.
//
// Тут стояли 72 і 24×3. Кількість дрібниць свідомо зменшили втричі («читались
// як посипка на печиві»), модульний тест оновили, а цей — ні: він падав шість
// днів і не повідомляв нікому нічого. Похідне число ламається лише тоді, коли
// ламається сам інваріант — що видів рівно три, що вони порівну і що всі
// намальовані одним викликом.
const PER_KIND = DEFAULT_TREE_GROUND_DETAIL_CONFIG.maximumInstancesByKindByLod.medium;
const EXPECTED_INSTANCES = PER_KIND.stone + PER_KIND['fallen-leaf'] + PER_KIND.moss;

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

test.describe('Tree Ground Detail Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders stable stones, fallen leaves and moss in one instanced draw call', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);
    await expect(preview).toHaveAttribute('data-tree-lab-ground-detail', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-ground-detail-id', 'tree:ground-detail:field');
    await expect(preview).toHaveAttribute(
      'data-tree-lab-ground-detail-template-id',
      'tree:ground-detail:shared-chip',
    );
    await expect(preview).toHaveAttribute(
      'data-tree-lab-ground-detail-material-id',
      'tree:ground-detail:material',
    );
    await expect(preview).toHaveAttribute('data-tree-lab-ground-detail-budget-exceeded', 'false');
    await expect(preview).toHaveAttribute('data-tree-lab-ground-detail-anchored', 'true');
    await expect(preview).toHaveAttribute('data-tree-lab-ground-detail-prefix', 'true');

    const instances = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-instances'),
      'instances',
    );
    const stones = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-stones'),
      'stones',
    );
    const leaves = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-fallen-leaves'),
      'fallenLeaves',
    );
    const moss = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-moss'),
      'moss',
    );
    const budget = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-budget'),
      'budget',
    );
    const sharedTriangles = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-shared-triangles'),
      'sharedTriangles',
    );
    const renderedTriangles = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-rendered-triangles'),
      'renderedTriangles',
    );
    const detailDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-draw-calls'),
      'detailDrawCalls',
    );
    const extraMaterials = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-extra-materials'),
      'extraMaterials',
    );
    const totalMaterials = numeric(
      await preview.getAttribute('data-tree-lab-ground-detail-total-materials'),
      'totalMaterials',
    );
    const totalDrawCalls = numeric(
      await preview.getAttribute('data-tree-lab-draw-calls'),
      'totalDrawCalls',
    );

    expect(instances).toBe(EXPECTED_INSTANCES);
    expect(stones).toBe(PER_KIND.stone);
    expect(leaves).toBe(PER_KIND['fallen-leaf']);
    expect(moss).toBe(PER_KIND.moss);
    // Порівну по видах — не смак: нижчі LOD мусять бути префіксами вищих, а
    // нерівні частки цю властивість ламають (див. `groundDetail/config.ts`).
    expect(new Set([stones, leaves, moss]).size).toBe(1);
    expect(stones + leaves + moss).toBe(instances);
    expect(budget).toBe(EXPECTED_INSTANCES);
    expect(sharedTriangles).toBeGreaterThan(0);
    expect(renderedTriangles).toBe(sharedTriangles * instances);
    expect(detailDrawCalls).toBe(1);
    expect(extraMaterials).toBe(1);
    expect(totalMaterials).toBe(3);
    expect(totalDrawCalls).toBeLessThanOrEqual(4);

    await page.screenshot({
      path: 'test-results/tree-ground-detail-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
