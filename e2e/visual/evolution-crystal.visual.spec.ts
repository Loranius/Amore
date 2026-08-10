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
    // The crystal now shares its canvas with the 3D portal environment
    // (field, dais, inlay, pillars, stars), so renderer.info counts those too.
    // The budget below still has to be about the crystal, hence the scene's own
    // cost is published by the component rather than folded into a looser
    // constant — see crystal3d/scene/portalScene.ts.
    const environmentDrawCalls = numberAttribute(
      await preview.getAttribute('data-portal-environment-draw-calls'),
      'environmentDrawCalls',
    );
    const environmentTriangles = numberAttribute(
      await preview.getAttribute('data-portal-environment-triangles'),
      'environmentTriangles',
    );
    const renderedTriangles = numberAttribute(
      await preview.getAttribute('data-evolution-rendered-triangles'),
      'renderedTriangles',
    );
    // Поправки на кристали бажань тут більше немає, і це не спрощення тесту:
    // бажання пішли зі сцени зовсім. Вішліст показує їх власним шаром сфер
    // (DOM), тож у полотні лишились артефакт і оточення — рівно те, про що
    // цей бюджет і був.

    expect(meshCount).toBeGreaterThan(0);
    expect(materialCount).toBeGreaterThan(0);
    expect(materialCount).toBeLessThanOrEqual(8);
    expect(drawCalls).toBeGreaterThan(0);
    // The invariant is unchanged: crystal bodies are batched by material, so the
    // crystal costs about one draw call per material, not one per body. One
    // extra is allowed for the optional Sparkles points object.
    const crystalDrawCalls = drawCalls - environmentDrawCalls;
    expect(crystalDrawCalls).toBeGreaterThan(0);
    expect(crystalDrawCalls).toBeLessThanOrEqual(materialCount + 1);
    expect(crystalDrawCalls).toBeLessThan(meshCount);
    // Same correction as the draw calls: what must stay inside the published
    // geometry budget is the crystal, and the environment draws a fixed,
    // never-culled set of triangles on top of it.
    const crystalTriangles = renderedTriangles - environmentTriangles;
    expect(crystalTriangles).toBeGreaterThan(0);
    expect(crystalTriangles).toBeLessThanOrEqual(topologyTriangles);

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
