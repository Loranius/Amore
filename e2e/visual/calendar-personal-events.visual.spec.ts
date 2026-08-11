import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function login(page: Page) {
  test.skip(!visualUserName || !visualUserPin, 'Visual login secrets are required');

  await page.goto('./#/login', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: visualUserName!, exact: true }).click();
  for (const digit of visualUserPin!) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
  await page.waitForURL(/#\/?$/, { timeout: 20_000 });
}

async function expectInsideViewport(page: Page, selector: string) {
  const viewport = page.viewportSize();
  const box = await page.locator(selector).boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
}

test('Плани: календар і наш шлях на Pixel 8 Pro', async ({ page }, testInfo) => {
  await login(page);

  // /calendar is intentionally kept as a legacy address. The calendar now
  // lives inside the unified Plans module and the old URL must land there.
  await page.goto('./#/calendar', { waitUntil: 'networkidle' });
  await page.waitForURL(/#\/plans(?:\?.*)?$/, { timeout: 20_000 });

  const module = page.locator('.plans-module');
  await expect(module).toBeVisible();
  await expect(module).toHaveAttribute('data-section', 'calendar');

  const tabs = page.getByRole('tablist', { name: 'Розділи планів' });
  const calendarTab = tabs.getByRole('tab', { name: /Календар/ });
  const eventsTab = tabs.getByRole('tab', { name: /Події/ });
  await expect(calendarTab).toHaveAttribute('aria-selected', 'true');
  await expect(eventsTab).toBeVisible();

  const calendar = page.locator('.cal-month');
  await expect(calendar).toBeVisible();
  await expectInsideViewport(page, '.cal-month');
  await page.screenshot({
    path: testInfo.outputPath('plans-calendar-pixel-8-pro.png'),
    fullPage: true,
  });

  // Relationship milestones are no longer another calendar view. They live
  // in the neighbouring "Події" section as the dedicated "Наш шлях" surface.
  await eventsTab.click();
  await expect(module).toHaveAttribute('data-section', 'events');
  await expect(eventsTab).toHaveAttribute('aria-selected', 'true');

  const journey = page.locator('.relationship-journey');
  await expect(journey).toBeVisible();
  await expectInsideViewport(page, '.relationship-journey');
  await journey.screenshot({ path: testInfo.outputPath('plans-relationship-journey.png') });

  // The section-level CTA must open the current relationship-event form, not
  // the deleted list-view/calendar form that the previous visual test targeted.
  await page.locator('.pm-fab').click();
  const relationshipForm = page.locator('.cal-entry-sheet');
  await expect(relationshipForm).toBeVisible();
  await expect(relationshipForm.getByRole('heading', { name: 'Що сталося у вашій історії?' })).toBeVisible();
  await expectInsideViewport(page, '.cal-entry-sheet');
  await relationshipForm.screenshot({ path: testInfo.outputPath('plans-relationship-event-form.png') });
  await relationshipForm.getByRole('button', { name: 'Скасувати' }).click();
  await expect(relationshipForm).toBeHidden();
});
