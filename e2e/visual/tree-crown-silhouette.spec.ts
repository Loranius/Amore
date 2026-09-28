import { expect, test, type Page, type Locator } from '@playwright/test';
import { hasVisualCredentials, loginByEmail } from './emailLogin';
import { expectTreeAcceptancePass } from './treeAcceptance';



async function login(page: Page, url: string) {
  await page.goto(url);
  await loginByEmail(page);
}

function numeric(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be finite, received ${String(value)}`);
  return parsed;
}

test.describe('Tree Crown Silhouette Pixel 8 Pro acceptance', () => {
  test.skip(!hasVisualCredentials, 'Visual preview credentials are required');

  test('renders the polished crown and preserved negative space inside the mobile budget', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');

    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 20_000 });
    await expectTreeAcceptancePass(preview, 20_000);

    const leaves = numeric(await preview.getAttribute('data-tree-lab-leaf-instances'), 'leaves');
    const emptyCells = numeric(await preview.getAttribute('data-tree-lab-empty-cells'), 'emptyCells');
    const negativeSpace = numeric(
      await preview.getAttribute('data-tree-lab-negative-space'),
      'negativeSpace',
    );
    const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');
    const buildMs = numeric(await preview.getAttribute('data-tree-lab-build-ms'), 'buildMs');

    expect(leaves).toBeGreaterThan(0);
    expect(emptyCells).toBeGreaterThanOrEqual(0);
    expect(negativeSpace).toBeGreaterThanOrEqual(0);
    expect(negativeSpace).toBeLessThanOrEqual(1);
    expect(drawCalls).toBeLessThanOrEqual(4);
    expect(buildMs).toBeLessThanOrEqual(220);

    await page.screenshot({
      path: 'test-results/tree-crown-silhouette-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });
});
