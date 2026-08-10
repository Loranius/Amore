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

    // ── Вішліст у світі: сфери ─────────────────────────────
    //
    // Тут стояла перевірка `.wishlist-grid` і бульбашкового вигляду з його
    // псевдошарами. Обидва зникли з цього шляху: коли WebGL є, бажання
    // показує власний шар сфер (ADR-0028), а бульбашки лишились запасним
    // виглядом без WebGL — тобто в цьому середовищі недосяжним. Тест падав
    // саме на `.wishlist-grid`, і це перше, що мав би сказати CI у день
    // переходу; він мовчав, бо на push у main не запускався взагалі.
    const sphereField = page.locator('.wl-sphere-field');
    await expect(sphereField).toBeVisible();

    const spheres = sphereField.locator('.wl-sphere');
    const sphereCount = await spheres.count();
    expect(sphereCount).toBeGreaterThan(0);

    // §48: користуватись можна, не розуміючи тривимірної сцени. Сфера — це
    // кнопка з назвою бажання, і саме назву читає програма читання екрана.
    for (let index = 0; index < Math.min(sphereCount, 5); index += 1) {
      await expect(spheres.nth(index)).toHaveAccessibleName(/\S/);
    }

    // І жодна не за краєм: сузір'я розкладається в пікселях поля, а поле —
    // це екран телефона.
    const outside = await sphereField.evaluate((field) => {
      const box = field.getBoundingClientRect();
      return Array.from(field.querySelectorAll('.wl-sphere')).filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left < box.left - 1
          || rect.right > box.right + 1
          || rect.top < 0
          || rect.bottom > window.innerHeight;
      }).length;
    });
    expect(outside).toBe(0);

    await page.screenshot({
      path: testInfo.outputPath('05-wishlist-spheres.png'),
      fullPage: true,
    });

    // Дотик по сфері відкриває той самий аркуш деталей, що й раніше: змінилось
    // подання, а не дані.
    await spheres.first().click();
    const sphereSheet = page.locator('.wl-cloud-sheet');
    await expect(sphereSheet).toBeVisible();
    await expect(sphereSheet.locator('.wl-cloud-sheet-title')).not.toBeEmpty();
    await sphereSheet.screenshot({
      path: testInfo.outputPath('05b-wishlist-sphere-details.png'),
    });
    await page.getByRole('button', { name: 'Закрити деталі мрії' }).click();
    await expect(sphereSheet).toBeHidden();

    // Вигляд перемикається в аркуші навігації — у світі панелі пріоритетів
    // немає, і саме тому решта цього тесту раніше мовчки пропускалась.
    const openWorldNav = async () => {
      await page.locator('.wl-world-nav-toggle').click();
      await expect(page.locator('.wl-world-sheet')).toBeVisible();
    };
    const chooseView = async (label: string) => {
      await openWorldNav();
      await page.locator('.wl-world-sheet').getByRole('button', { name: label, exact: true }).click();
      await page.locator('.wl-world-scrim').click({ position: { x: 10, y: 10 } });
      await expect(page.locator('.wl-world-sheet')).toBeHidden();
    };

    await chooseView('Список');
    {
      const feed = page.locator('.wl-feed-view');
      await expect(feed).toBeVisible();
      await feed.screenshot({ path: testInfo.outputPath('06-wishlist-feed.png') });
    }

    await chooseView('Полароїд');
    {
      const polaroids = page.locator('.wl-polaroid-view');
      await expect(polaroids).toBeVisible();
      await polaroids.screenshot({ path: testInfo.outputPath('08-wishlist-polaroids.png') });
    }

    await chooseView('Кристали');
    await expect(sphereField).toBeVisible();

    // Нижче — детальні перевірки карток списку й полароїдів. Вони тримаються
    // за панель пріоритетів, тобто працюють на шляху без WebGL; у світі цей
    // блок пропускається, як і пропускався досі.
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
