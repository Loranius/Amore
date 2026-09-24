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

    /*
     * ТУТ СТОЯЛИ `data-section="calendar"` І ВКЛАДКИ «Розділи планів».
     * Ні того, ні тих у модулі більше немає. Тест цього не помітив і
     * півтора місяця падав у CI на атрибуті, якого ніхто не знімав, — а
     * падаючий тест не стереже нічого.
     *
     * ПОТІМ ТУТ СТОЯЛО `.cal-month`, І ЦЕЙ САМИЙ КОМЕНТАР НЕ ВРЯТУВАВ:
     * ADR-0207 зняв сітку місяця з першого вікна, а рядок лишився, і
     * набір знову падав — тепер уже на класі, який цей же тест оголосив
     * «тим, що справді визначає модуль». Урок не в тому, щоб краще
     * вибирати клас. Урок у тому, що перевірка, прив'язана до НАСЛІДКУ
     * рішення, застаріває разом із версткою; перевірка, прив'язана до
     * самого РІШЕННЯ, падає лише тоді, коли рішення скасували.
     *
     * Рішення ADR-0207 дослівно: перше вікно модуля — це ОДИН план, а
     * не сітка місяця. Нижче саме воно й перевіряється, з обох боків:
     * герой присутній, місяця у першому вікні немає, але двері до нього
     * є. Цю перевірку не можна задовольнити, повернувши сітку вгору.
     */
    await expect(page.locator('.pm-sheet')).toBeVisible();
    await expect(page.locator('.pf-hero')).toBeVisible();
    await expect(page.locator('.cal-month')).toHaveCount(0);
    /*
     * Локатор звужений до лічильників навмисно. `getByRole` шукає назву
     * ПІДРЯДКОМ, а в шапці модуля стоїть надпис «Календар і задуми»: варто
     * комусь зробити його кнопкою — і `name: 'Календар'` дав би два збіги,
     * тобто падіння строгого режиму замість перевірки дверей.
     */
    await expect(
      page.locator('.pf-quiet').filter({ hasText: /^Календар$/ }),
    ).toHaveCount(1);

    /*
     * Календар не видалений — він за своїм лічильником, і `/calendar`
     * веде сюди ж із уже розкритим місяцем. Двері перевіряються тут, бо
     * саме цей ADR їх переніс; окремий спек
     * (`calendar-personal-events.visual.spec.ts`) іде тим самим шляхом
     * заради інших полів і тримає другий бік тієї ж обіцянки.
     */
    /*
     * Хеш міняється ЗСЕРЕДИНИ сторінки, а не `page.goto`, і це не стиль.
     * `goto` на адресу, що різниться лише хешем, може виконати повне
     * перезавантаження — і тоді перевірка мовчки питала б вхід ЗЗОВНІ,
     * тобто гілку, яка працювала й до виправлення. Слабкий тест, що
     * непомітно міряє інше, — та сама вада, проти якої цей блок і
     * написаний. Саме цим переходом ваду й виміряно на живому порталі:
     * до виправлення `.cal-month` лишався 0, після — 1.
     */
    await page.evaluate(() => { window.location.hash = '/plans?view=calendar'; });
    /*
     * ЗАПАС ЧАСУ ТУТ НАЗВАНИЙ ЧИСЛОМ, А НЕ ВЗЯТИЙ ЗІ СТЕЛІ. Перехід
     * виміряно опитуванням у пісочниці: на збірці календар з'являється
     * за ~3.3 с, на dev-сервері за ~7.6 с (різниця — компіляція Vite на
     * першому показі модуля). Типові 10 с Playwright лишають запас у
     * шість десятих секунди, а саме з такого запасу й виходять миготливі
     * тести.
     *
     * Це НЕ твердження про телефон: під SwiftShader кадри йдуть по три на
     * секунду (`scripts/live/README.md`, пастка №7), тож тутешню тривалість
     * не можна переносити на пристрій пари. Число тут — лише мірка
     * пісочниці, з якої взятий запас.
     */
    await expect(page.locator('.cal-month')).toBeVisible({ timeout: 20_000 });

    /*
     * Назад — і розділ ЛИШАЄТЬСЯ розкритим: параметр зник, але його
     * зникнення нічого не закриває. Закрити може лише пара, і саме це
     * перевіряється дотиком нижче. Якби залежність ефекту була рядком
     * запиту, а не булевим значенням, розділ відкривався б назад і став
     * би незакриваним.
     */
    await page.evaluate(() => { window.location.hash = '/plans'; });
    await expect(page.locator('.cal-month')).toBeVisible();

    await page.locator('.pf-quiet').filter({ hasText: /^Календар$/ }).click();
    await expect(page.locator('.cal-month')).toHaveCount(0);
    await expect(page.locator('.pm-sheet')).toBeVisible();

    const addButton = page.locator('.plans-module .fab');
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

    /*
     * ПЛЮС БІЛЬШЕ НЕ ПИТАЄ «План чи подія?» — і це не спрощення тесту, а
     * рішення продукту, записане просто над кнопкою в `PlansPage.tsx`: у
     * цьому модулі плюс завжди означає план, а календарна подія
     * створюється контекстно, другим тапом по даті.
     *
     * Тест іще питав вибір і падав на заголовку «Що створюємо?».
     */
    await addButton.click();
    const createSheet = page.locator('.plan-create-sheet');
    await expect(createSheet).toBeVisible();
    await expect(createSheet.getByRole('heading', { name: 'Що хочете зробити разом?' })).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plans-create-composer.png') });

    await createSheet.getByRole('button', { name: /Обкладинка плану/ }).click();
    await expect(createSheet.locator('.plan-create-photo-picker')).toBeVisible();
    await createSheet.screenshot({ path: testInfo.outputPath('plan-create-photo-picker.png') });

    await createSheet.getByRole('button', { name: 'Скасувати' }).click();
    await expect(createSheet).toBeHidden();
  });
});
