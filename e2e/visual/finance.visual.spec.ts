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

test('Finance shared goals keep a full-width Pixel 8 Pro layout', async ({ page }, testInfo) => {
  await login(page);
  await page.goto('/#/budget');

  await expect(page.getByRole('heading', { name: 'Спільні цілі' })).toBeVisible();
  await expect(page.locator('.finance-goals-hero')).toBeVisible();
  await expect(page.locator('.finance-goal, .finance-goals-empty').first()).toBeVisible({
    timeout: 15_000,
  });

  await page.screenshot({
    path: testInfo.outputPath('finance-mobile-full.png'),
    fullPage: true,
  });

  await expectInsideViewport(page, page.locator('.budget'));
  await expectInsideViewport(page, page.locator('.finance-goals-hero'));

  const goal = page.locator('.finance-goal').first();
  if (await goal.count()) {
    const mainCard = goal.locator('.finance-goal-main-card');
    const progressCard = goal.locator('.goal-progress-card');
    const forecastCard = goal.locator('.goal-forecast-card');

    await expect(mainCard).toBeVisible();
    await expect(progressCard).toBeVisible();
    await expect(forecastCard).toBeVisible();

    await expectInsideViewport(page, goal);
    await expectInsideViewport(page, mainCard);
    await expectInsideViewport(page, progressCard);
    await expectInsideViewport(page, forecastCard);

    const goalBox = await goal.boundingBox();
    expect(goalBox!.width).toBeGreaterThan(360);

    await goal.screenshot({
      path: testInfo.outputPath('finance-goal-mobile.png'),
    });

    await goal.getByRole('button', { name: 'Обговорення' }).click();

    const discussion = page.locator('.goal-comments-modal');
    await expect(discussion).toBeVisible();
    await expect(discussion.getByText('Обговорення цілі')).toBeVisible();
    await expect(discussion.getByLabel('Додати коротку думку')).toBeVisible();
    await expect(discussion.locator('.goal-comments-state')).toBeHidden({ timeout: 15_000 });
    await expect(
      discussion.locator('.goal-comments-list, .goal-comments-empty').first(),
    ).toBeVisible();
    await expectInsideViewport(page, discussion);

    await discussion.screenshot({
      path: testInfo.outputPath('finance-goal-discussion-mobile.png'),
    });

    await discussion.getByRole('button', { name: 'Закрити обговорення' }).click();
    await expect(discussion).toBeHidden();
  }
});
