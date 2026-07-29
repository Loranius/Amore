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
  test('captures the approved Plans widget system', async ({ page }, testInfo) => {
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

    const overview = page.locator('.plans-overview');
    await expect(overview).toBeVisible();
    await page.waitForTimeout(1_200);

    const addButton = page.locator('.plans-overview-add');
    await expect(addButton).toBeVisible();
    const addBox = await addButton.boundingBox();
    expect(addBox).not.toBeNull();
    expect(addBox!.width).toBeLessThanOrEqual(56);
    expect(addBox!.height).toBeLessThanOrEqual(56);

    await page.screenshot({
      path: testInfo.outputPath('plans-mobile-full.png'),
      fullPage: true,
    });

    const featured = page.locator('.plans-featured-card');
    if (await featured.count()) {
      await featured.screenshot({ path: testInfo.outputPath('plans-nearest-widget.png') });
    }

    const upcoming = page.locator('.plans-upcoming-grid');
    if (await upcoming.count()) {
      await upcoming.screenshot({ path: testInfo.outputPath('plans-upcoming-three.png') });
    }

    const ideas = page.locator('.plans-idea-rail');
    if (await ideas.count()) {
      await ideas.screenshot({ path: testInfo.outputPath('plans-undated-ideas.png') });
    }

    await addButton.click();
    const createSheet = page.locator('.plan-create-sheet');
    await expect(createSheet).toBeVisible();
    await createSheet.getByRole('button', { name: /Обкладинка плану/ }).click();
    await expect(createSheet.locator('.plan-create-photo-picker')).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plan-create-photo-picker.png') });
    await createSheet.getByRole('button', { name: 'Скасувати' }).click();
    await expect(createSheet).toBeHidden();

    if (await featured.count()) {
      await featured.first().click();
      await expect(page.locator('.plan-detail-page')).toBeVisible();

      const related = page.locator('details.plan-disclosure').filter({ hasText: 'Пов’язане' }).first();
      if (await related.count()) {
        if ((await related.getAttribute('open')) === null) {
          await related.locator('summary').click();
        }

        const tiles = related.locator('.plan-link-grid');
        if (await tiles.count()) {
          await expect(tiles).toBeVisible();
          await page.waitForTimeout(900);
          await related.screenshot({ path: testInfo.outputPath('plan-related-photo-tiles.png') });
        }
      }
    }
  });
});
