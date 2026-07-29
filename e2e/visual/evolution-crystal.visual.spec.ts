import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

function numberAttribute(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number, received ${String(value)}`);
  return parsed;
}

test.describe('Evolution crystal Pixel 8 Pro acceptance', () => {
  test('renders real module data through the batched preview pipeline', async ({ page }, testInfo) => {
    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'Evolution capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.goto('./?engine=evolution#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();
    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);
    await page.waitForURL(/\?engine=evolution#\/?$/, { timeout: 20_000 });

    const preview = page.locator('[data-evolution-preview="ready"]');
    await expect(preview).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.evolution-preview-badge--error')).toHaveCount(0);
    await expect(preview).toHaveAttribute('data-evolution-runtime', 'ready', { timeout: 20_000 });

    const meshCount = numberAttribute(await preview.getAttribute('data-evolution-meshes'), 'meshCount');
    const materialCount = numberAttribute(await preview.getAttribute('data-evolution-materials'), 'materialCount');
    const topologyTriangles = numberAttribute(await preview.getAttribute('data-evolution-triangles'), 'topologyTriangles');
    const drawCalls = numberAttribute(await preview.getAttribute('data-evolution-draw-calls'), 'drawCalls');
    const renderedTriangles = numberAttribute(
      await preview.getAttribute('data-evolution-rendered-triangles'),
      'renderedTriangles',
    );

    expect(meshCount).toBeGreaterThan(0);
    expect(materialCount).toBeGreaterThan(0);
    expect(materialCount).toBeLessThanOrEqual(8);
    expect(drawCalls).toBeGreaterThan(0);
    // One additional draw call is allowed for the optional Sparkles points object.
    expect(drawCalls).toBeLessThanOrEqual(materialCount + 1);
    expect(drawCalls).toBeLessThan(meshCount);
    expect(renderedTriangles).toBeGreaterThan(0);
    expect(renderedTriangles).toBeLessThanOrEqual(topologyTriangles);

    await preview.screenshot({ path: testInfo.outputPath('evolution-crystal-pixel-8-pro.png') });
    await page.screenshot({
      path: testInfo.outputPath('evolution-crystal-home-full.png'),
      fullPage: true,
    });

    await testInfo.attach('evolution-runtime-metrics.json', {
      body: Buffer.from(JSON.stringify({
        meshCount,
        materialCount,
        topologyTriangles,
        drawCalls,
        renderedTriangles,
        quality: await preview.getAttribute('data-evolution-quality'),
        buildMs: await preview.getAttribute('data-evolution-build-ms'),
      }, null, 2)),
      contentType: 'application/json',
    });
  });
});
