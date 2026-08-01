import { expect, test } from '@playwright/test';

test('Phase 15 verifies the exact release manifest before mounting Godot', async ({ page }) => {
  await page.goto('/e2e/godot/?releasePreflight=1&godotReleaseOps=1');

  const harness = page.locator('[data-godot-harness="react"]');
  const preview = page.locator('[data-godot-evolution="device-acceptance"]');
  const panel = page.locator('[data-godot-release-control="phase-15"]');

  await expect(harness).toHaveAttribute('data-godot-fatal-failure', '');
  await expect(preview).toHaveAttribute('data-godot-release-preflight', 'ready');
  await expect(preview).toHaveAttribute('data-godot-release-preflight-reason', 'manifest-verified');
  await expect(preview).toHaveAttribute('data-godot-release-id', 'ci-phase15-automation');
  await expect(preview).toHaveAttribute('data-godot-release-build-sha', /^[0-9a-f]{40}$/);
  await expect(preview).toHaveAttribute('data-godot-release-total-bytes', /^\d+$/);
  await expect(preview).toHaveAttribute('data-godot-status', 'accepted');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-godot-release-preflight', 'ready');
  await expect(panel).toHaveAttribute('data-godot-release-assets', '4');

  await page.screenshot({
    path: 'test-results/phase15-release-candidate-preflight.png',
    fullPage: true,
  });
});

test('Phase 15 fails closed before iframe mount when the manifest is not approved', async ({ page }) => {
  await page.route('**/godot/evolution-engine/release-manifest.json', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        version: 'godot-release-candidate-v1',
        phase: 15,
        runtimeVersion: '4.7.1',
        releaseId: 'ci-phase15-automation',
        acceptanceDigest: 'f'.repeat(64),
        buildSha: 'b'.repeat(40),
        generatedAt: '2026-08-01T12:00:00.000Z',
        assets: [],
        totalBytes: 0,
      }),
    });
  });

  await page.goto('/e2e/godot/?releasePreflight=1');
  const harness = page.locator('[data-godot-harness="react"]');
  const preview = page.locator('[data-godot-evolution="device-acceptance"]');

  await expect(harness).toHaveAttribute('data-godot-fatal-failure', 'release-preflight');
  await expect(preview).toHaveAttribute('data-godot-status', 'error');
  await expect(preview).toHaveAttribute('data-godot-release-preflight', 'failed');
  await expect(page.locator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]')).toHaveCount(0);
});

test('Phase 15 rollback drill selects Three.js without reporting a runtime failure', async ({ page }) => {
  await page.goto('/e2e/godot/?godotRollbackDrill=1');
  const harness = page.locator('[data-godot-harness="react"]');
  const fallback = page.locator('[data-godot-three-fallback="rollback-drill"]');

  await expect(harness).toHaveAttribute('data-godot-rollback-drill', 'true');
  await expect(harness).toHaveAttribute('data-godot-fatal-failure', '');
  await expect(fallback).toBeVisible();
  await expect(page.locator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]')).toHaveCount(0);

  await page.screenshot({
    path: 'test-results/phase15-rollback-drill.png',
    fullPage: true,
  });
});
