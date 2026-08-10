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

test.describe('Tree Leaf Orientation Pixel 8 Pro acceptance', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('renders the oriented crown inside the existing mobile budget', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);

    const leaves = numeric(await preview.getAttribute('data-tree-lab-leaf-instances'), 'leaves');
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');
    const materials = numeric(await preview.getAttribute('data-tree-lab-material-count'), 'materials');
    const buildMs = numeric(await preview.getAttribute('data-tree-lab-build-ms'), 'buildMs');

    expect(leaves).toBeGreaterThan(0);
    expect(drawCalls).toBeLessThanOrEqual(4);
    expect(materials).toBeLessThanOrEqual(3);
    // Cold synchronous production builds are accepted against the published
    // Tree Production Acceptance limit, not the obsolete pre-JIT 80 ms gate.
    expect(buildMs).toBeLessThanOrEqual(220);

    await page.screenshot({
      path: 'test-results/tree-leaf-orientation-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
