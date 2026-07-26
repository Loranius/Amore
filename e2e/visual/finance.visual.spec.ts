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

test('Finance shared goals keep a full-width Pixel 8 Pro layout', async ({ page }, testInfo) => {
  await login(page);
  await page.goto('/#/budget');

  await expect(page.getByRole('heading', { name: 'Спільні цілі' })).toBeVisible();
  await expect(page.locator('.finance-goals-hero')).toBeVisible();

  const contentOverflow = await page.locator('.content').evaluate((element) => (
    element.scrollWidth > element.clientWidth + 1
  ));
  expect(contentOverflow).toBe(false);

  const goal = page.locator('.finance-goal').first();
  if (await goal.count()) {
    await expect(goal.locator('.finance-goal-main-card')).toBeVisible();
    await expect(goal.locator('.goal-progress-card')).toBeVisible();
    await expect(goal.locator('.goal-forecast-card')).toBeVisible();

    const goalBox = await goal.boundingBox();
    expect(goalBox).not.toBeNull();
    expect(goalBox!.width).toBeGreaterThan(360);

    await goal.screenshot({
      path: testInfo.outputPath('finance-goal-mobile.png'),
    });
  }

  await page.screenshot({
    path: testInfo.outputPath('finance-mobile-full.png'),
    fullPage: true,
  });
});
