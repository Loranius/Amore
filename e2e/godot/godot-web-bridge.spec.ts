import { expect, test, type Page } from '@playwright/test';

async function expectAcceptedRuntime(page: Page) {
  const harness = page.locator('[data-godot-harness="react"]');
  const preview = page.locator('[data-godot-evolution="mobile-hardened"]');
  await expect(harness).toBeVisible();
  await expect(harness).toHaveAttribute('data-godot-fatal-failure', '');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-godot-status', 'accepted');
  await expect(preview).toHaveAttribute('data-godot-state-signature', /^[0-9a-f]{16}$/);
  await expect(preview).toHaveAttribute('data-godot-quality', /^(high|balanced|economy)$/);
  await expect(preview).toHaveAttribute('data-godot-render-scale', /^(1\.00|0\.86|0\.72)$/);
  await expect(preview).toHaveAttribute('data-godot-life-hz', /^(60|30|20)$/);

  await expect.poll(async () => Number(await preview.getAttribute('data-godot-fps'))).toBeGreaterThan(0);
  await expect(preview).toHaveAttribute('data-godot-frame-ms', /^\d+(\.\d+)?$/);
  await expect(preview).toHaveAttribute('data-godot-draw-calls', /^\d+$/);
  await expect(preview).toHaveAttribute('data-godot-primitives', /^\d+$/);
  await expect(preview).toHaveAttribute('data-godot-static-memory-mb', /^\d+(\.\d+)?$/);

  const iframe = page.locator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]');
  await expect(iframe).toBeVisible();
  const godotFrame = page.frameLocator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]');
  await expect(godotFrame.locator('#canvas')).toBeVisible();
  await expect(godotFrame.locator('#boot')).toHaveAttribute('data-hidden', 'true');
  return { harness, preview, godotFrame };
}

function godotContentFrame(page: Page) {
  const frame = page.frames().find(candidate => candidate.url().includes('/godot/evolution-engine/index.html'));
  if (!frame) throw new Error('Godot iframe content frame is missing.');
  return frame;
}

test('React receives mobile runtime telemetry from Godot 4.7.1', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  await page.goto('/e2e/godot/');
  const { preview } = await expectAcceptedRuntime(page);
  await expect(preview).toHaveAttribute('data-godot-motion', 'full');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'false');
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/phase12-mobile-telemetry-pixel-8-pro.png',
    fullPage: true,
  });
});

test('Godot suspends and restores without changing the canonical visual state', async ({ page }) => {
  await page.goto('/e2e/godot/');
  const { preview } = await expectAcceptedRuntime(page);
  const signatureBefore = await preview.getAttribute('data-godot-state-signature');

  await page.screenshot({
    path: 'test-results/phase12-before-background-restore-pixel-8-pro.png',
    fullPage: true,
  });

  const frame = godotContentFrame(page);
  await frame.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(preview).toHaveAttribute('data-godot-lifecycle', 'pagehide');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'true');

  await frame.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(preview).toHaveAttribute('data-godot-lifecycle', 'pageshow');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'false');
  await expect.poll(async () => Number(await preview.getAttribute('data-godot-restores'))).toBeGreaterThanOrEqual(1);
  await expect(preview).toHaveAttribute('data-godot-state-signature', signatureBefore ?? '');
  await expect(preview).toHaveAttribute('data-godot-status', 'accepted');

  await page.screenshot({
    path: 'test-results/phase12-after-background-restore-pixel-8-pro.png',
    fullPage: true,
  });
});

test('Godot canvas tap activates the React portal action', async ({ page }) => {
  await page.goto('/e2e/godot/');
  const { harness, godotFrame } = await expectAcceptedRuntime(page);
  await expect(harness).toHaveAttribute('data-godot-activation-count', '0');

  await godotFrame.locator('#canvas').click({ position: { x: 210, y: 240 } });
  await expect(harness).toHaveAttribute('data-godot-activation-count', '1');
});

test('Godot Life Engine respects browser reduced motion', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/e2e/godot/');
  const { preview } = await expectAcceptedRuntime(page);
  await expect(preview).toHaveAttribute('data-godot-motion', 'reduced');
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/phase12-reduced-motion-pixel-8-pro.png',
    fullPage: true,
  });
});
