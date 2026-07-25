import { expect, test, type Page } from '@playwright/test';

const visualUserName = process.env.VISUAL_USER_NAME?.trim();
const visualUserPin = process.env.VISUAL_USER_PIN?.trim();

async function enterPin(page: Page, pin: string) {
  for (const digit of pin) {
    if (!/^\d$/.test(digit)) throw new Error('VISUAL_USER_PIN must contain digits only.');
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

test.describe('Amore mobile visual preview', () => {
  test('captures login and authenticated wishlist', async ({ page }, testInfo) => {
    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-screen')).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('01-login-mobile.png'),
      fullPage: true,
    });

    if (!visualUserName || !visualUserPin) {
      testInfo.annotations.push({
        type: 'notice',
        description:
          'Authenticated wishlist capture skipped. Add VISUAL_USER_NAME and VISUAL_USER_PIN repository secrets.',
      });
      return;
    }

    await page.getByRole('button', { name: visualUserName, exact: true }).click();
    await enterPin(page, visualUserPin);

    await page.waitForURL(/#\/?$/, { timeout: 20_000 });
    await page.goto('./#/wishlist', { waitUntil: 'networkidle' });

    const wishlist = page.locator('.wishlist');
    await expect(wishlist).toBeVisible();

    // Let images and layout settle while reduced-motion keeps the capture stable.
    await page.waitForTimeout(1_200);

    await page.screenshot({
      path: testInfo.outputPath('02-wishlist-mobile-full.png'),
      fullPage: true,
    });

    const controls = page.locator('.wl-wishlist-controls');
    await expect(controls).toBeVisible();
    await controls.screenshot({
      path: testInfo.outputPath('03-wishlist-controls-collapsed.png'),
    });

    const priorityToggle = page.locator('.wl-board-toolbar-toggle');
    if (await priorityToggle.isVisible()) {
      await priorityToggle.click();
      await expect(page.locator('.wl-board-toolbar-panel')).toBeVisible();
      await controls.screenshot({
        path: testInfo.outputPath('04-wishlist-controls-expanded.png'),
      });
      await priorityToggle.click();
    }

    const grid = page.locator('.wishlist-grid');
    await expect(grid).toBeVisible();
    await grid.scrollIntoViewIfNeeded();

    const bubbleView = page.locator('.wl-bubble-view');
    await expect(bubbleView).toBeVisible();

    const firstBubbleItem = bubbleView.locator('.wl-cloud-item').first();
    if (await firstBubbleItem.count()) {
      const pseudoLayers = await firstBubbleItem.evaluate((item) => {
        const bubble = item.querySelector<HTMLElement>('.wl-cloud-bubble');
        if (!bubble) throw new Error('Wishlist bubble was not found.');

        const itemBefore = getComputedStyle(item, '::before');
        const itemAfter = getComputedStyle(item, '::after');
        const bubbleBefore = getComputedStyle(bubble, '::before');

        return {
          parentIsBubbleView: item.parentElement?.classList.contains('wl-bubble-view') ?? false,
          itemBeforeDisplay: itemBefore.display,
          itemBeforeAnimation: itemBefore.animationName,
          itemAfterDisplay: itemAfter.display,
          itemAfterAnimation: itemAfter.animationName,
          bubbleBeforeDisplay: bubbleBefore.display,
          bubbleBeforeAnimation: bubbleBefore.animationName,
        };
      });

      expect(pseudoLayers).toEqual({
        parentIsBubbleView: true,
        itemBeforeDisplay: 'none',
        itemBeforeAnimation: 'none',
        itemAfterDisplay: 'none',
        itemAfterAnimation: 'none',
        bubbleBeforeDisplay: 'none',
        bubbleBeforeAnimation: 'none',
      });
    }

    await bubbleView.screenshot({
      path: testInfo.outputPath('05-wishlist-bubbles.png'),
    });

    if (await priorityToggle.isVisible()) {
      await priorityToggle.click();
      const feedOption = page.locator('.wl-board-view-option[data-view="feed"]');
      await expect(feedOption).toBeVisible();
      await feedOption.click();
      await priorityToggle.click();
      await expect(page.locator('.wl-board-toolbar-panel')).toBeHidden();

      const feed = page.locator('.wl-feed-view');
      await expect(feed).toBeVisible();
      await feed.scrollIntoViewIfNeeded();

      const firstFeedCard = page.locator('.wl-feed-card').first();
      if (await firstFeedCard.count()) {
        await expect(firstFeedCard.locator('.wl-feed-card__title')).not.toBeEmpty();
        await expect(firstFeedCard.locator('.wl-feed-card__description')).not.toBeEmpty();
        await expect(firstFeedCard.locator('.wl-feed-card__priority')).not.toBeEmpty();
        await expect(firstFeedCard.locator('.wl-feed-card__price')).not.toBeEmpty();

        const layout = await firstFeedCard.evaluate((card) => {
          const trigger = card.querySelector<HTMLElement>('.wl-feed-card__trigger');
          const media = card.querySelector<HTMLElement>('.wl-feed-card__media');
          const title = card.querySelector<HTMLElement>('.wl-feed-card__title');
          const description = card.querySelector<HTMLElement>('.wl-feed-card__description');
          if (!trigger || !media || !title || !description) {
            throw new Error('Wishlist feed card structure is incomplete.');
          }

          const triggerRect = trigger.getBoundingClientRect();
          const mediaRect = media.getBoundingClientRect();
          const titleRect = title.getBoundingClientRect();
          const descriptionRect = description.getBoundingClientRect();
          return {
            titleInside: titleRect.left >= triggerRect.left && titleRect.right <= triggerRect.right,
            descriptionInside:
              descriptionRect.left >= triggerRect.left && descriptionRect.right <= triggerRect.right,
            copyAfterMedia: titleRect.left > mediaRect.right,
          };
        });

        expect(layout).toEqual({
          titleInside: true,
          descriptionInside: true,
          copyAfterMedia: true,
        });

        await firstFeedCard.locator('.wl-feed-card__trigger').click();
        const detailsSheet = page.locator('.wl-cloud-sheet');
        await expect(detailsSheet).toBeVisible();
        await expect(detailsSheet.locator('.wl-cloud-sheet-title')).not.toBeEmpty();
        await detailsSheet.screenshot({
          path: testInfo.outputPath('07-wishlist-details-sheet.png'),
        });
        await page.getByRole('button', { name: 'Закрити деталі мрії' }).click();
        await expect(detailsSheet).toBeHidden();
      }

      await feed.screenshot({
        path: testInfo.outputPath('06-wishlist-feed.png'),
      });
    }
  });
});
