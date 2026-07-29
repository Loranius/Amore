import { expect, test } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME;
const visualUserPin = process.env.VISUAL_USER_PIN;

async function login(page: import('@playwright/test').Page) {
  test.skip(!visualUserName || !visualUserPin, 'Visual login secrets are required');

  await page.goto('/#/login');
  await expect(page.getByRole('heading', { name: /Хто сьогодні заходить у портал/ })).toBeVisible();
  await page.getByRole('button', { name: visualUserName!, exact: true }).click();

  for (const digit of visualUserPin!) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }

  await expect(page.getByText(/Портал відкрито/)).toBeVisible();
  await page.waitForURL((url) => !url.hash.includes('/login'), { timeout: 15_000 });
}

async function expectInsideViewport(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
) {
  const viewport = page.viewportSize();
  const box = await locator.boundingBox();

  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test('Скарбничка: одна спільна сума й вільний ліміт на Pixel 8 Pro', async ({ page }, testInfo) => {
  await login(page);
  await page.goto('/#/piggybank');

  const balance = page.locator('.piggy-balance');
  await expect(balance).toBeVisible({ timeout: 15_000 });
  await expect(balance.getByRole('heading', { name: 'Скарбничка' })).toBeVisible();
  await expect(balance.getByText('Спільні відкладені гроші')).toBeVisible();
  await expect(page.getByText('Вільний ліміт', { exact: true })).toBeVisible();
  await expect(page.getByText('Спільні цілі', { exact: true })).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath('piggybank-mobile-full.png'),
    fullPage: true,
  });

  await expectInsideViewport(page, page.locator('.budget'));
  await expectInsideViewport(page, balance);
  await balance.screenshot({ path: testInfo.outputPath('piggybank-balance-card.png') });

  await balance.getByRole('button', { name: 'Змінити суму' }).click();
  const sheet = page.locator('.piggy-balance-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Загальна сума, ₴')).toBeVisible();
  await expectInsideViewport(page, sheet);
  await sheet.screenshot({ path: testInfo.outputPath('piggybank-balance-editor.png') });
  await sheet.getByRole('button', { name: 'Скасувати' }).click();
  await expect(sheet).toBeHidden();
});
