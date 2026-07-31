import { expect, test } from '@playwright/test';

test('React sends canonical payload to the Godot 4.7.1 Web runtime', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  await page.goto('/e2e/godot/');

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

  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: 'test-results/godot-react-bridge-pixel-8-pro.png',
    fullPage: true,
  });
});
