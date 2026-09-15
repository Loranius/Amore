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

    /*
     * ВИГЛЯД ПЕРЕМИКАЄТЬСЯ В АКОРДЕОНІ ФІЛЬТРІВ, і селектори в нього
     * інші, ніж були: `.wl-world-nav-toggle` і `.wl-world-sheet`
     * перейменовані у `wl-top-filter-*`, коли аркуш переїхав порталом
     * усередину `.wl-wishlist-controls` — саме щоб старі
     * fixed/absolute правила не витягували його в кут екрана.
     *
     * Тест лишився на старих іменах і півтора місяця падав у CI по
     * таймауту, чекаючи на кнопку, якої немає. Разом із ним мовчки
     * помер і весь хвіст цього файлу.
     */
    const openFilters = async () => {
      await page.locator('.wl-top-filter-toggle').click();
      await expect(page.locator('.wl-top-filter-sheet')).toBeVisible();
    };
    const chooseView = async (label: string) => {
      await openFilters();
      const sheet = page.locator('.wl-top-filter-sheet');
      await sheet.getByRole('button', { name: label, exact: true }).click();
      await page.locator('.wl-top-filter-toggle').click();
      await expect(sheet).toBeHidden();
    };

    /*
     * ВИДІВ ДВА, А НЕ ТРИ. Полароїдного вигляду у вішлісті більше немає:
     * полароїд переїхав у «Спогади» (ADR-0181), і тест, який його тут
     * шукав, стеріг би функцію, якої свідомо позбулись.
     */
    await chooseView('Список');
    {
      const grid = page.locator('.wl-grid-view');
      await expect(grid).toBeVisible();
      await grid.screenshot({ path: testInfo.outputPath('06-wishlist-grid.png') });
    }

    await chooseView('Кристали');
    await expect(sphereField).toBeVisible();
  });
});
