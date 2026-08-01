import { expect, test } from '@playwright/test';

async function expectAcceptedRuntime(page: Parameters<typeof test>[0] extends never ? never : any) {
  const harness = page.locator('[data-godot-harness="react"]');
  const preview = page.locator('[data-godot-evolution="isolated"]');
  await expect(harness).toBeVisible();
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute('data-godot-status', 'accepted');
  await expect(preview).toHaveAttribute('data-godot-state-signature', /^[0-9a-f]{16}$/);

  const iframe = page.locator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]');
  await expect(iframe).toBeVisible();
  const godotFrame = page.frameLocator('iframe[title="Amore Evolution Engine — Godot 4.7.1"]');
  await expect(godotFrame.locator('#canvas')).toBeVisible();
  await expect(godotFrame.locator('#boot')).toHaveAttribute('data-hidden', 'true');
  return preview;
}

test('React sends canonical payload to the Godot 4.7.1 Web runtime', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  await page.goto('/e2e/godot/');
  const preview = await expectAcceptedRuntime(page);
  await expect(preview).toHaveAttribute('data-godot-motion', 'full');
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/godot-react-bridge-pixel-8-pro.png',
    fullPage: true,
  });
});

test('Godot Life Engine respects browser reduced motion', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto('/e2e/godot/');
  const preview = await expectAcceptedRuntime(page);
  await expect(preview).toHaveAttribute('data-godot-motion', 'reduced');
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/godot-react-bridge-reduced-motion-pixel-8-pro.png',
    fullPage: true,
  });
});
