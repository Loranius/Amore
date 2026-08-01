import { expect, test, type Page } from '@playwright/test';

async function expectAcceptedRuntime(page: Page) {
  const harness = page.locator('[data-godot-harness="react"]');
  const preview = page.locator('[data-godot-evolution="device-acceptance"]');
  await expect(harness).toBeVisible();
  await expect(harness).toHaveAttribute('data-godot-fatal-failure', '');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-godot-status', 'accepted');
  await expect(preview).toHaveAttribute('data-godot-state-signature', /^[0-9a-f]{16}$/);
  await expect(preview).toHaveAttribute('data-godot-quality', /^(high|balanced|economy)$/);
  await expect(preview).toHaveAttribute('data-godot-render-scale', /^(1\.00|0\.86|0\.72)$/);
  await expect(preview).toHaveAttribute('data-godot-life-hz', /^(60|30|20)$/);
  await expect(preview).toHaveAttribute('data-godot-health', /^(warming|healthy|degraded|critical)$/);

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

async function completeOrbitGesture(page: Page) {
  const canvas = page.frameLocator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]').locator('#canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Godot canvas bounding box is missing.');
  const x = box.x + box.width * 0.5;
  const y = box.y + Math.min(box.height - 70, 400);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 86, y - 24, { steps: 8 });
  await page.mouse.up();
}

test('React receives Phase 13 runtime telemetry from Godot 4.7.1', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  await page.goto('/e2e/godot/');
  const { preview } = await expectAcceptedRuntime(page);
  await expect(preview).toHaveAttribute('data-godot-motion', 'full');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'false');
  await expect(preview).toHaveAttribute('data-godot-health-fallback', 'false');
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/phase13-runtime-health-pixel-8-pro.png',
    fullPage: true,
  });
});

test('Phase 13 physical-device console reaches PASS with orbit, restore and 30 samples', async ({ page }) => {
  await page.goto('/e2e/godot/?godotDiagnostics=1');
  const { harness, preview } = await expectAcceptedRuntime(page);
  const panel = page.locator('[data-godot-device-acceptance="phase-13"]');
  await expect(panel).toBeVisible();
  await panel.evaluate(element => {
    (element as HTMLElement).style.pointerEvents = 'none';
  });

  const signatureBefore = await preview.getAttribute('data-godot-state-signature');
  await completeOrbitGesture(page);
  await expect.poll(async () => Number(await preview.getAttribute('data-godot-orbit-count'))).toBeGreaterThanOrEqual(1);
  await expect.poll(async () => Number(await harness.getAttribute('data-godot-interaction-count'))).toBeGreaterThanOrEqual(1);

  const frame = godotContentFrame(page);
  await frame.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(preview).toHaveAttribute('data-godot-lifecycle', 'pagehide');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'true');
  await frame.evaluate(() => window.dispatchEvent(new Event('pageshow')));
  await expect(preview).toHaveAttribute('data-godot-lifecycle', 'pageshow');
  await expect(preview).toHaveAttribute('data-godot-suspended', 'false');
  await expect.poll(async () => Number(await preview.getAttribute('data-godot-restores'))).toBeGreaterThanOrEqual(1);
  await expect(preview).toHaveAttribute('data-godot-state-signature', signatureBefore ?? '');

  await expect.poll(
    async () => Number(await panel.getAttribute('data-godot-health-samples')),
    { timeout: 90_000 },
  ).toBeGreaterThanOrEqual(30);
  await expect(panel).toHaveAttribute('data-godot-health-status', 'healthy');
  await expect(panel).toHaveAttribute('data-godot-acceptance-passed', 'true');
  await expect(preview).toHaveAttribute('data-godot-acceptance-passed', 'true');

  const reportText = await page.locator('[data-godot-acceptance-report]').textContent();
  const report = JSON.parse(reportText ?? '{}') as {
    passed?: boolean;
    privacy?: string;
    criteria?: { orbitCompleted?: boolean; backgroundRestoreCompleted?: boolean };
  };
  expect(report.passed).toBe(true);
  expect(report.criteria?.orbitCompleted).toBe(true);
  expect(report.criteria?.backgroundRestoreCompleted).toBe(true);
  expect(report.privacy).toContain('No Artifact DNA');
  expect(reportText).not.toContain('event:a');

  await page.screenshot({
    path: 'test-results/phase13-device-acceptance-pass-pixel-8-pro.png',
    fullPage: true,
  });
});

test('Godot canvas tap activates the React portal action', async ({ page }) => {
  await page.goto('/e2e/godot/');
  const { harness, godotFrame } = await expectAcceptedRuntime(page);
  await expect(harness).toHaveAttribute('data-godot-activation-count', '0');

  await godotFrame.locator('#canvas').click({ position: { x: 210, y: 240 } });
  await expect(harness).toHaveAttribute('data-godot-activation-count', '1');
  await expect.poll(async () => Number(await harness.getAttribute('data-godot-interaction-count'))).toBeGreaterThanOrEqual(1);
});

test('sustained critical telemetry triggers the production health fallback', async ({ page }) => {
  await page.goto('/e2e/godot/');
  const { harness, preview } = await expectAcceptedRuntime(page);
  const frame = godotContentFrame(page);

  await frame.evaluate(() => {
    for (let index = 0; index < 8; index += 1) {
      window.parent.postMessage({
        type: 'amore:godot:telemetry',
        version: '4.7.1',
        quality: 'economy',
        fps: 10,
        frame_ms: 100,
        draw_calls: 12,
        primitives: 900,
        static_memory_mb: 96,
        render_scale: 0.72,
        life_hz: 20,
        suspended: false,
        restores: 0,
      }, window.location.origin);
    }
  });

  await expect(harness).toHaveAttribute('data-godot-fatal-failure', 'performance-health');
  await expect(preview).toHaveAttribute('data-godot-status', 'error');
  await expect(preview).toHaveAttribute('data-godot-health-fallback', 'true');
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
    path: 'test-results/phase13-reduced-motion-pixel-8-pro.png',
    fullPage: true,
  });
});
