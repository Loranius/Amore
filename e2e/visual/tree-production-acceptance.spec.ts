import { expect, test, type Locator, type Page } from '@playwright/test';

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

async function expectAcceptedContract(preview: Locator) {
  await expect(preview).toBeVisible({ timeout: 25_000 });
  await expect(preview).toHaveAttribute('data-tree-production-acceptance', 'true');
  await expect(preview).toHaveAttribute(
    'data-tree-production-contract-id',
    'tree:production-acceptance:contract',
  );
  await expect(preview).toHaveAttribute(
    'data-tree-production-pipeline-id',
    'tree:production-pipeline:v1',
  );
  await expect(preview).toHaveAttribute('data-tree-production-static-status', 'pass');
  await expect(preview).toHaveAttribute('data-tree-production-runtime-status', 'pass', {
    timeout: 25_000,
  });
  await expect(preview).toHaveAttribute('data-tree-lab-acceptance', 'pass');
  await expect(preview).toHaveAttribute('data-tree-production-phase-order', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-phase-fingerprints', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-leaf-chain', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-life-prefix', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-negative-space', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-ground-anchored', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-terrain-merged', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-soil-preserved', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-bark-preserved', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-ground-detail-anchored', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-ground-detail-prefix', 'true');
  await expect(preview).toHaveAttribute('data-tree-production-violations', '');

  const phaseCount = numeric(
    await preview.getAttribute('data-tree-production-phase-count'),
    'phaseCount',
  );
  const expectedPhases = numeric(
    await preview.getAttribute('data-tree-production-phase-expected'),
    'expectedPhases',
  );
  const drawCalls = numeric(await preview.getAttribute('data-tree-lab-draw-calls'), 'drawCalls');
  const buildMs = numeric(await preview.getAttribute('data-tree-lab-build-ms'), 'buildMs');
  expect(phaseCount).toBe(expectedPhases);
  expect(phaseCount).toBe(20);
  expect(drawCalls).toBeLessThanOrEqual(4);
  // This is the cold synchronous build measured before browser/JIT warmup.
  expect(buildMs).toBeLessThanOrEqual(220);
}

test.describe('Tree Production Acceptance Pixel 8 Pro', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('publishes one reload-stable fixture contract for the complete tree pipeline', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=fixture&treeLod=medium#/login');
    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expectAcceptedContract(preview);
    await expect(preview).toHaveAttribute('data-tree-production-as-of-policy', 'fixed-fixture');

    const signature = await preview.getAttribute('data-tree-production-signature');
    const identitySignature = await preview.getAttribute('data-tree-production-identity-signature');
    expect(signature).toBeTruthy();
    expect(identitySignature).toBeTruthy();

    await page.reload();
    await expectAcceptedContract(preview);
    await expect(preview).toHaveAttribute('data-tree-production-signature', signature ?? '');
    await expect(preview).toHaveAttribute(
      'data-tree-production-identity-signature',
      identitySignature ?? '',
    );

    await page.screenshot({
      path: 'test-results/tree-production-acceptance-fixture-pixel-8-pro.png',
      fullPage: true,
    });
  });

  test('keeps portal history or its explicit fixture fallback production-safe after reload', async ({ page }) => {
    await login(page, '?engine=tree-lab&treeSource=portal&treeLod=medium#/login');
    const preview = page.locator('[data-tree-lab-preview="ready"]');
    await expectAcceptedContract(preview);
    await expect(preview).toHaveAttribute('data-tree-lab-source', /portal|fixture-fallback/);

    const source = await preview.getAttribute('data-tree-lab-source');
    await expect(preview).toHaveAttribute(
      'data-tree-production-as-of-policy',
      source === 'portal' ? 'couple-day' : 'fixed-fixture',
    );
    const signature = await preview.getAttribute('data-tree-production-signature');

    await page.reload();
    await expectAcceptedContract(preview);
    await expect(preview).toHaveAttribute('data-tree-production-signature', signature ?? '');
  });
});
