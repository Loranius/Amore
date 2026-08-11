import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Plans mobile visual preview', () => {
  test('captures the current unified Plans module', async ({ page }, testInfo) => {
    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description: 'Plans capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();
    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/plans', { waitUntil: 'networkidle' });

    const module = page.locator('.plans-module');
    await expect(module).toBeVisible();
    await expect(module).toHaveAttribute('data-section', 'calendar');

    const tabs = page.getByRole('tablist', { name: 'Розділи планів' });
    await expect(tabs.getByRole('tab', { name: /Календар/ })).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.getByRole('tab', { name: /Події/ })).toBeVisible();

    // The old overview/featured/upcoming widget system was removed when Plans
    // and Calendar were unified. The month surface is now the primary module.
    await expect(page.locator('.pm-sheet')).toBeVisible();
    await expect(page.locator('.cal-month')).toBeVisible();

    const addButton = page.locator('.pm-fab');
    await expect(addButton).toBeVisible();
    const addBox = await addButton.boundingBox();
    expect(addBox).not.toBeNull();
    if (addBox) {
      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(addBox.x).toBeGreaterThanOrEqual(-1);
      expect(addBox.x + addBox.width).toBeLessThanOrEqual((viewport?.width ?? 0) + 1);
    }

    await page.screenshot({
      path: testInfo.outputPath('plans-mobile-full.png'),
      fullPage: true,
    });

    // Calendar's single CTA first asks whether the user wants a Plan or an
    // Event. This chooser is part of the approved current interaction model.
    await addButton.click();
    const createSheet = page.locator('.plan-create-sheet');
    await expect(createSheet).toBeVisible();
    await expect(createSheet.getByRole('heading', { name: 'Що створюємо?' })).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plans-create-chooser.png') });

    await createSheet.getByRole('button', { name: /^План\b/ }).click();
    await expect(createSheet.getByRole('heading', { name: 'Що хочете зробити разом?' })).toBeVisible();

    await createSheet.getByRole('button', { name: /Обкладинка плану/ }).click();
    await expect(createSheet.locator('.plan-create-photo-picker')).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plan-create-photo-picker.png') });

    await createSheet.getByRole('button', { name: 'Скасувати' }).click();
    await expect(createSheet).toBeHidden();
  });
});
