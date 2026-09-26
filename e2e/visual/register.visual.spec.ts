import { expect, test, type Page, type Route } from '@playwright/test';

// ============================================================
// Реєстрація пари — перевірка, яку ганяє CI (ADR-0209 §11.7 → §12).
// ------------------------------------------------------------
// ЦЕЙ НАБІР ГОВОРИТЬ ІЗ ЖИВОЮ БАЗОЮ ПАРИ, тож він побудований так, щоб
// НЕ МІГ у неї записати. Два перехоплення, і обидва обовʼязкові:
//
//   1. `couple-register` не виходить за межі браузера ЖОДНОГО разу.
//      Тіло запиту записується й перевіряється тут; відповідь
//      підроблена. Саме цим прийомом перевірено «Графік» (ADR-0208):
//      натиснути кнопку по-справжньому й не дати запису дійти.
//   2. Порожній портал підроблюється відповіддю `users = []`. База не
//      чиститься — підмінюється те, що бачить сторінка.
//
// ЧОМУ ВЗАГАЛІ E2E. ADR-0207 §9 коштував двох червоних прогонів саме
// тому, що межа «у модуля немає e2e» була записана без перевірки. Тут
// межа названа після `ls e2e/visual/` — і закрита.
//
// ЧОМУ ПЕРЕВІРЯЄТЬСЯ РІШЕННЯ, А НЕ ВЕРСТКА (той самий урок). Кожне
// твердження нижче падає лише тоді, коли скасували рішення ADR-0209:
// «на зайнятому порталі реєстрації немає», «PIN набирається двічі»,
// «однаковий PIN на двох заборонений», «дата дає кількість днів».
// ============================================================

const PIN_LENGTH = 8;

/*
 * ПІДПИСИ СТАДІЇ — ТАК, ЯК ВОНИ НАПИСАНІ, А НЕ ЯК НАМАЛЬОВАНІ.
 *
 * Перша редакція чекала «НОВИЙ PIN» — бо саме це надрукував зонд. Зонд
 * читав `innerText`, який ЗАСТОСОВУЄ `text-transform: uppercase`;
 * `toHaveText` читає вміст DOM, де стоїть «Новий PIN». Тобто в спеку
 * потрапив намальований текст замість написаного, і перевірка падала на
 * різниці, якої на екрані не видно взагалі.
 */
const PIN_STAGE_NEW = 'Новий PIN';
const PIN_STAGE_CONFIRM = 'Підтвердження';

/** Той самий підрахунок, що на екрані: повні доби між датами. */
function daysTogether(from: string, today: Date): number {
  const start = new Date(`${from}T00:00:00`);
  const now = new Date(today);
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000);
}

async function typePin(page: Page, pin: string) {
  for (const digit of pin) {
    await page.locator('.pin-key', { hasText: new RegExp(`^${digit}$`) }).first().click();
  }
}

test.describe('Реєстрація пари на Pixel 8 Pro', () => {
  test('зайнятий портал відмовляє одразу, а не після чотирьох PIN', async ({ page }, testInfo) => {
    /*
     * Перехоплення СТОЇТЬ, хоч цей шлях і не мусить нічого слати: якби
     * екран усе ж надіслав — тест має це побачити, а база не має.
     */
    let sent = 0;
    await page.route('**/functions/v1/couple-register', async (route: Route) => {
      sent += 1;
      await route.fulfill({ status: 500, body: '{"error":"server_error"}' });
    });

    /*
     * ЗАЙНЯТІСТЬ ТЕЖ ПІДРОБЛЯЄТЬСЯ, І ЦЕ НЕ СПРОЩЕННЯ.
     *
     * Перша редакція брала користувачів із живої бази пари. Вона впала —
     * у пісочниці браузер не має прямого виходу назовні (`scripts/live/
     * README.md`, пастка №2), і екран двадцять секунд стояв на
     * «Хвилинку». Але важливіше інше: перевіряється РІШЕННЯ «є пара →
     * реєстрації немає», а не вміст чужої бази. Підробка робить спеку
     * герметичною, однаковою локально й у CI, і геть незалежною від
     * того, що зараз лежить у пари.
     */
    await page.route('**/rest/v1/users*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify([{ id: 1, name: 'Перший' }, { id: 2, name: 'Друга' }]),
      });
    });

    await page.goto('./#/register', { waitUntil: 'networkidle' });

    // Рішення: на порталі, де пара вже є, реєстрації немає ЗОВСІМ.
    await expect(page.locator('.auth-title')).toHaveText('Цей портал уже зайнятий', { timeout: 20_000 });
    await expect(page.locator('.reg-input')).toHaveCount(0);

    // І двері назад ведуть на вхід, а не в нікуди.
    await page.locator('.reg-next').first().click();
    await expect(page.locator('.user-select')).toBeVisible();

    expect(sent, 'зайнятий портал не сміє нічого надсилати').toBe(0);
    await page.screenshot({ path: testInfo.outputPath('register-taken.png'), fullPage: true });
  });

  test('порожній портал проводить пару трьома кроками й нічого не пише', async ({ page }, testInfo) => {
    /*
     * ПОРОЖНЕЧА ПІДРОБЛЯЄТЬСЯ, А НЕ СТВОРЮЄТЬСЯ. `users` віддає `[]`
     * лише цій сторінці; у базі пари не змінюється нічого.
     */
    await page.route('**/rest/v1/users*', async (route: Route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: '[]',
      });
    });

    const bodies: string[] = [];
    await page.route('**/functions/v1/couple-register', async (route: Route) => {
      bodies.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        // Відповідь підроблена цілком: справжньої пари не створено.
        body: JSON.stringify({ ok: true, couple_id: 1, members: [{ id: 1, name: 'Олексій' }] }),
      });
    });

    // ── Порожній портал пропонує створити, а не показує пустий список ──
    await page.goto('./#/login', { waitUntil: 'networkidle' });
    await expect(page.locator('.auth-title')).toHaveText('Тут ще нікого немає', { timeout: 20_000 });
    await expect(page.locator('.user-btn')).toHaveCount(0);
    await page.locator('a.reg-next').click();

    // ── Крок 1: імена ────────────────────────────────────────────────
    await expect(page.locator('.auth-title')).toHaveText('Хто ви двоє?');
    const names = page.locator('.reg-input');
    await expect(names).toHaveCount(2);

    // Рішення: порожня форма МОВЧИТЬ — портал не свариться на незаймане.
    await expect(page.locator('.reg-problem')).toHaveCount(0);
    await expect(page.locator('.reg-next')).toBeDisabled();

    // Рішення: однакові імена заборонені — за ними обирають себе на вході.
    await names.nth(0).fill('Олексій');
    await names.nth(1).fill('Олексій');
    await expect(page.locator('.reg-problem')).toContainText('різнитись');
    await expect(page.locator('.reg-next')).toBeDisabled();

    await names.nth(1).fill('Марія');
    await expect(page.locator('.reg-problem')).toHaveCount(0);
    await page.locator('.reg-next').click();

    // ── Крок 2: PIN двічі для кожного ────────────────────────────────
    await expect(page.locator('.auth-title')).toHaveText('Олексій');
    await expect(page.locator('.reg-pin-stage')).toHaveText(PIN_STAGE_NEW);
    await expect(page.locator('.pin-dot')).toHaveCount(PIN_LENGTH);

    // Рішення: PIN набирається ДВІЧІ — шляху відновлення в порталі немає.
    await typePin(page, '12345678');
    await expect(page.locator('.reg-pin-stage')).toHaveText(PIN_STAGE_CONFIRM);

    // І незбіг не приймається мовчки.
    await typePin(page, '12345679');
    await expect(page.locator('.pin-error')).toContainText('не збігся');
    await expect(page.locator('.reg-pin-stage')).toHaveText(PIN_STAGE_NEW);

    await typePin(page, '12345678');
    await typePin(page, '12345678');
    await expect(page.locator('.auth-title')).toHaveText('Марія');

    // Рішення: однаковий PIN на двох — це один вхід на двох.
    await typePin(page, '12345678');
    await typePin(page, '12345678');
    await expect(page.locator('.pin-error')).toContainText('уже в першого');

    await typePin(page, '87654321');
    await typePin(page, '87654321');

    // ── Крок 3: дата й кількість днів ────────────────────────────────
    await expect(page.locator('.auth-title')).toHaveText('З якого дня ви разом?');
    await page.screenshot({ path: testInfo.outputPath('register-date.png'), fullPage: true });

    const started = '2015-06-14';
    await page.locator('input[type=date]').fill(started);

    /*
     * Число рахується ТУТ, а не вписане сталою: інакше перевірка
     * протухала б щодня — зелена сьогодні, червона завтра. Саме таке
     * правило записане в `.claude/rules/tests.md` про сталі вхідні:
     * стале має бути ВХІДНЕ, а не очікуване, коли відповідь залежить
     * від дати запуску.
     */
    const expected = daysTogether(started, new Date());
    await expect(page.locator('.reg-days')).toContainText(String(expected));

    // ── Надсилання: перехоплене, у базу не доходить ──────────────────
    await page.locator('.reg-next').click();
    await expect.poll(() => bodies.length, { timeout: 20_000 }).toBe(1);

    const payload = JSON.parse(bodies[0] ?? '{}') as {
      members?: { name: string; pin: string }[];
      started_at?: string;
    };
    expect(payload.started_at).toBe(started);
    expect(payload.members?.map((m) => m.name)).toEqual(['Олексій', 'Марія']);
    // Два РІЗНІ PIN, обидва по вісім цифр — те, що набрали, а не те, що показали.
    expect(payload.members?.map((m) => m.pin)).toEqual(['12345678', '87654321']);
    expect(new Set(payload.members?.map((m) => m.pin)).size).toBe(2);
  });
});
