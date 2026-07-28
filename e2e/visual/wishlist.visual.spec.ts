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
          itemAfterDisplay: itemAfter.display,
          bubbleBeforeDisplay: bubbleBefore.display,
          bubbleBeforeAnimation: bubbleBefore.animationName,
        };
      });

      // Інваріант той самий, що й був: за бульбашкою не стоять
      // декоративні шари туману. Стереже його `display: none` —
      // псевдоелемент без боксу не малюється й не анімується взагалі,
      // тож окремо перевіряти його animationName нема сенсу: це назва
      // правила, яке однаково нікуди не застосовується. Ці дві
      // перевірки прибрані як такі, що ловили не те.
      //
      // Змінилось по суті одне: `.wl-cloud-bubble::before` більше не
      // туман, а САМА бульбашка. У перловому вигляді цей шар був
      // овальною «мильною плівкою» позаду лінзи, і його вимикали. В
      // об'ємному склі (wishlistBubbleGlass.css) він накриває весь диск
      // і несе світлотінь та відблиски — без нього бульбашка перестає
      // бути бульбашкою. Тому `display: block` тут тепер вимога, а не
      // регресія. Його анімація лишається вимкненою: об'єм не крутиться.
      expect(pseudoLayers).toEqual({
        parentIsBubbleView: true,
        itemBeforeDisplay: 'none',
        itemAfterDisplay: 'none',
        bubbleBeforeDisplay: 'block',
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

      await priorityToggle.click();
      const polaroidOption = page.locator('.wl-board-view-option[data-view="polaroid"]');
      await expect(polaroidOption).toBeVisible();
      await polaroidOption.click();
      await priorityToggle.click();
      await expect(page.locator('.wl-board-toolbar-panel')).toBeHidden();

      const polaroidView = page.locator('.wl-polaroid-view');
      await expect(polaroidView).toBeVisible();
      await polaroidView.scrollIntoViewIfNeeded();

      const firstPolaroid = polaroidView.locator('.wl-polaroid-card').first();
      if (await firstPolaroid.count()) {
        await expect(firstPolaroid.locator('.wl-polaroid-card__title')).not.toBeEmpty();
        await expect(firstPolaroid.locator('.wl-polaroid-card__priority')).not.toBeEmpty();
        await expect(firstPolaroid.locator('.wl-cloud-bubble')).toHaveCount(0);
        await expect(firstPolaroid.locator('[data-wish-title]')).toHaveCount(0);

        const structure = await firstPolaroid.evaluate((card) => ({
          parentIsPolaroidView: card.parentElement?.classList.contains('wl-polaroid-view') ?? false,
          hasLegacyBoardClass: card.classList.contains('wl-board-view-item'),
        }));
        expect(structure).toEqual({
          parentIsPolaroidView: true,
          hasLegacyBoardClass: false,
        });
      }

      await polaroidView.screenshot({
        path: testInfo.outputPath('08-wishlist-polaroids.png'),
      });
    }
  });
});
