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

function numericAttribute(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be finite, received ${String(value)}`);
  return parsed;
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
