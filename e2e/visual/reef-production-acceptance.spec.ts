import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * ПЕРША ЖИВА ПЕРЕВІРКА РИФА (ADR-0204).
 *
 * Аудит 2026-09-20 §6.1: у кристала 58 модульних тестів і одна жива
 * перевірка, у дерева 42 і тринадцять, у рифа 17 і **жодної власної**.
 * За місяць риф отримав ADR-0182…0198 — близько п'ятнадцяти рішень,
 * включно з повною переробкою поверхні, — і жодне з них CI перевірити не
 * міг. Кожне твердження про риф спиралось на `.live`, запущений руками.
 *
 * Лабораторія рифа (`labs/reefLab.tsx`) сюди не годиться: її сторінки
 * немає у збірці продукту, а Playwright ганяє саме збірку. Тому
 * перевіряється ТОЙ САМИЙ риф, що бачить пара: `?artifact=reef`.
 *
 * ЧОГО ТУТ СВІДОМО НЕМАЄ — ЧИСЕЛ СЬОГОДНІШНЬОГО ДНЯ. Риф росте: на
 * 26 грудня додається колонія, і покриття, кількість тіл та трикутників
 * ідуть угору. Бюджет, знятий з одного віку, червонітиме на наступному
 * дні народження пари — тобто був би бомбою з годинником, а не сторожем.
 *
 * Тому перевіряється те, що НЕ залежить від віку. Виміряно в
 * лабораторії на 61 кадрі (віки 1…40 × чотири наповненості × сім
 * значень широти, `.audit/measure-reef-ages.mjs`):
 *
 *   | число            | мін    | макс   | від віку |
 *   |------------------|-------:|-------:|----------|
 *   | coral-share      | 0.1890 | 0.3558 | ні       |
 *   | body-aspect      | 1.0879 | 1.3187 | ні       |
 *   | dome-aspect      | 1.2195 | 1.4024 | ні, від широти |
 *   | coverage         | 0.0626 | 5.3934 | ТАК      |
 *   | coral-coverage   | 0.0228 | 5.1457 | ТАК      |
 *   | size-spread      | 2.2225 | 6.8052 | ТАК      |
 *   | трикутники       |   1704 |  79464 | ТАК      |
 *
 * Чотири нижні рядки не мають тут сталої межі саме тому, що ростуть.
 * Натомість вони перевіряються ТОЧНИМИ співвідношеннями, які тримались
 * у всіх 61 випадку без винятку.
 */

const userName = process.env.VISUAL_USER_NAME ?? '';
const userPin = process.env.VISUAL_USER_PIN ?? '';

async function login(page: Page, url: string) {
  await page.goto(url);
  await page.getByRole('button', { name: userName, exact: true }).click();
  for (const digit of userPin) {
    await page.getByRole('button', { name: digit, exact: true }).click();
  }
}

/** Голова рифа — одна на будь-який вік. */
const HEAD_TRIANGLES = 744;
/** Одне коралове тіло. */
const TRIANGLES_PER_BODY = 120;

/*
 * СМУГИ ДЛЯ ЧИСЕЛ, ЯКІ НЕ ЗАЛЕЖАТЬ ВІД ВІКУ.
 *
 * Межі взяті з виміряного розмаху із запасом, а не з голови: запас
 * потрібен, бо пара живе далі й може, наприклад, почати вести сьомий
 * модуль. Але він не такий, щоб смуга перестала щось означати —
 * «брила з кущиком» дала б `coral-share` глибоко під 0.1, а суцільна
 * купа коралів без каменю — понад 0.5.
 */
const BANDS = {
  /**
   * Яку частку висоти рифа дає найвищий корал.
   *
   * Головне число цієї спеки: воно відповідає на питання «це ще риф чи
   * вже брила з кущиком». ADR-0191 записав, чому воно СТАЛЕ в будь-якому
   * віці — і висота корала, і висота купола ростуть від одного масштабу
   * голови, тож їхня частка скорочується. Тут ця сталість уперше
   * стережеться, а не лише описується.
   */
  coralShare: [0.16, 0.40],
  /** Стрункість коралового тіла, медіана. Еталон із GLB — 1.05. */
  bodyAspect: [1.0, 1.4],
  /** Радіус купола, поділений на висоту. Півкуля = 1.0. */
  domeAspect: [1.2, 1.45],
} as const;

function numeric(value: string | null, name: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name}: очікувалось число, отримано ${String(value)}`);
  return parsed;
}

/** Повних діб між двома днями за UTC — без годинних поясів і без локалі. */
function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  expect(Number.isFinite(start) && Number.isFinite(end), `дати ${from}…${to}`).toBe(true);
  return Math.round((end - start) / 86_400_000);
}

interface ReefFacts {
  years: number;
  breadth: number;
  bodies: number;
  meshes: number;
  triangles: number;
  daysTogether: number;
  asOf: string;
  startedAt: string;
  coralShare: number;
  bodyAspect: number;
  domeAspect: number;
  coverage: number;
  coralCoverage: number;
  sizeSpread: number;
}

async function readReef(reef: Locator): Promise<ReefFacts> {
  const attribute = async (name: string) => reef.getAttribute(name);
  return {
    years: numeric(await attribute('data-reef-years'), 'років'),
    breadth: numeric(await attribute('data-reef-breadth'), 'широта'),
    bodies: numeric(await attribute('data-evolution-bodies'), 'тіл'),
    meshes: numeric(await attribute('data-evolution-meshes'), 'мешів'),
    triangles: numeric(await attribute('data-evolution-triangles'), 'трикутників'),
    daysTogether: numeric(await attribute('data-reef-days-together'), 'днів разом'),
    asOf: (await attribute('data-reef-as-of')) ?? '',
    startedAt: (await attribute('data-reef-started-at')) ?? '',
    coralShare: numeric(await attribute('data-reef-coral-share'), 'частка корала'),
    bodyAspect: numeric(await attribute('data-reef-body-aspect'), 'стрункість тіла'),
    domeAspect: numeric(await attribute('data-reef-dome-aspect'), 'стрункість купола'),
    coverage: numeric(await attribute('data-reef-coverage'), 'покриття'),
    coralCoverage: numeric(await attribute('data-reef-coral-coverage'), 'покриття коралами'),
    sizeSpread: numeric(await attribute('data-reef-size-spread'), 'розмах розмірів'),
  };
}

test.describe('Reef production acceptance Pixel 8 Pro', () => {
  test.skip(!userName || userPin.length !== 8, 'Visual preview credentials are required');

  test('builds the couple’s reef and keeps its shape invariants', async ({ page }) => {
    test.slow();
    await login(page, '?artifact=reef#/login');

    /*
     * `error` — окремий стан сцени, і він виглядає як тиха порожнеча.
     * Спершу перевіряємо, що його НЕМАЄ: інакше наступний `waitFor`
     * просто впав би за часом, не сказавши чому.
     */
    await expect(page.locator('[data-reef-preview="error"]')).toHaveCount(0);
    const reef = page.locator('[data-reef-preview="ready"]');
    await expect(reef).toBeVisible({ timeout: 40_000 });

    const facts = await readReef(reef);

    // ── Арифметика віку ──────────────────────────────────────
    /*
     * Зсув на одиницю — найдешевша вада цього рушія й найдорожча в
     * наслідках: таблиця, підписана «рік 4», описувала б п'ятирічну пару.
     * Лабораторія ловила його двічі КАДРОМ, і обидва рази жоден тест не
     * бачив нічого. Тут число нарешті звіряється з датами, з яких воно
     * і зроблене.
     */
    expect(facts.startedAt, 'сцена мусить публікувати перший день').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(facts.asOf, 'сцена мусить публікувати «сьогодні» пари').toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(facts.daysTogether).toBe(daysBetween(facts.startedAt, facts.asOf));

    /*
     * Колоній рівно стільки, скільки РОЗПОЧАТИХ років — поточний
     * рахується. Рівність із двох боків замість «приблизно»: якщо
     * рахунок років колись поїде, це має бути видно, а не згладжено.
     */
    const startedYears = Math.floor(facts.daysTogether / 366) + 1;
    const generousYears = Math.floor(facts.daysTogether / 365) + 1;
    expect(facts.years).toBeGreaterThanOrEqual(startedYears);
    expect(facts.years).toBeLessThanOrEqual(generousYears);

    // ── Точні співвідношення, які тримались у всіх 61 кадрі ──
    /*
     * Голова + по тілу на корал, і нічого більше. Ця рівність ловить
     * зміну щільності коралової сітки, зайвий меш у сцені й будь-який
     * тихий приріст геометрії — тобто рівно те, чого не видно оком і що
     * дорого коштує на телефоні.
     */
    expect(
      facts.triangles,
      `трикутники: ${facts.bodies} тіл × ${TRIANGLES_PER_BODY} + голова ${HEAD_TRIANGLES}`,
    ).toBe(facts.bodies * TRIANGLES_PER_BODY + HEAD_TRIANGLES);

    /*
     * Один інстансований меш на колонію плюс голова. Якщо колонії колись
     * перестануть інстансуватись, це число вибухне разом із викликами
     * малювання — і побачити це треба тут, а не на телефоні пари.
     */
    expect(facts.meshes, 'один меш на колонію плюс голова').toBe(facts.years + 1);

    // ── Смуги, які не залежать від віку ─────────────────────
    expect(facts.coralShare, 'це ще риф, а не брила з кущиком')
      .toBeGreaterThanOrEqual(BANDS.coralShare[0]);
    expect(facts.coralShare).toBeLessThanOrEqual(BANDS.coralShare[1]);
    expect(facts.bodyAspect).toBeGreaterThanOrEqual(BANDS.bodyAspect[0]);
    expect(facts.bodyAspect).toBeLessThanOrEqual(BANDS.bodyAspect[1]);
    expect(facts.domeAspect).toBeGreaterThanOrEqual(BANDS.domeAspect[0]);
    expect(facts.domeAspect).toBeLessThanOrEqual(BANDS.domeAspect[1]);

    /*
     * Широта веде ШИРИНУ купола, і це видно числом: у лабораторії
     * `dome-aspect` іде рівною драбиною від 1.2195 при широті 0 до
     * 1.4024 при широті 6. Нахил драбини тут НЕ закріплюється — він
     * властивість теперішньої реалізації, — а кінці закріплюються, бо
     * вони і є зміст: пара, яка веде все, має ширший купол, ніж пара,
     * яка не веде нічого.
     */
    expect(facts.breadth).toBeGreaterThanOrEqual(0);
    expect(facts.breadth).toBeLessThanOrEqual(6);
    if (facts.breadth === 0) expect(facts.domeAspect).toBeLessThanOrEqual(1.23);
    if (facts.breadth === 6) expect(facts.domeAspect).toBeGreaterThanOrEqual(1.39);

    /*
     * Ті числа, що ростуть, лишаються під наглядом хоча б знизу: риф
     * пари не може бути порожнім, і саме «порожній риф» — найімовірніша
     * форма тихої регресії (план зібрався, тіл нуль, кадр із самим
     * каменем).
     */
    expect(facts.bodies, 'риф без жодного коралового тіла — це камінь').toBeGreaterThan(0);
    expect(facts.coverage).toBeGreaterThan(0);
    expect(facts.coralCoverage).toBeGreaterThan(0);
    expect(facts.sizeSpread, 'усі тіла одного розміру — це не риф').toBeGreaterThan(1);

    /*
     * ЧОМУ ТУТ НЕМАЄ БЮДЖЕТУ НА ВИКЛИКИ МАЛЮВАННЯ. У дерева він є
     * (`drawCalls <= 4`), і він там заслужений: дерево — одна збірка
     * сталого розміру. Риф додає меш щороку, тож будь-яке одне число
     * тут було б або взяте зі стелі, або приколочене до віку пари.
     * Виміряти залежність нема де: лабораторія рифа не має зонда
     * рантайму, а портал показує рівно один вік. Тому перевіряється
     * лише те, що зонд ВЗАГАЛІ дорахував, — а бюджет лишається
     * ненаписаним до окремого заміру. Виміряне сьогодні: 20 викликів
     * на п'яти мешах.
     *
     * Сама ця перевірка не порожня: зонд звітує після 24 КАДРІВ, тож
     * «ready» означає, що сцена справді малюється. Замерзлий риф — це
     * регресія, яку пара побачила б одразу, а жодне число вище її не
     * ловить: план зібрався б, атрибути стали б на місце, а кадр стояв
     * би.
     *
     * ЗАПАС У ХВИЛИНУ — ПРО РАННЕР, А НЕ ПРО РИФ. На продакшн-збірці під
     * програмним растеризатором ці 24 кадри займають близько 15 секунд
     * (виміряно; перша редакція чекала 9 і падала саме тут). Число каже
     * про те, чим малює раннер, і нічого не каже про телефон пари — та
     * сама межа, що в `treeAcceptance.ts` про `build-ms`.
     */
    await expect(reef).toHaveAttribute('data-evolution-runtime', 'ready', { timeout: 60_000 });
    expect(numeric(await reef.getAttribute('data-evolution-draw-calls'), 'виклики малювання'))
      .toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/reef-production-acceptance-pixel-8-pro.png',
      fullPage: true,
    });
  });

  test('rebuilds byte-identical numbers after reload', async ({ page }) => {
    test.slow();
    /*
     * ДЕТЕРМІНІЗМ — НЕ ПРИЄМНА ВЛАСТИВІСТЬ, А КОНТРАКТ. `CLAUDE.md`:
     * «Identical canonical inputs, versions, configuration, and seeds
     * produce identical canonical outputs». Перезавантаження — найдешевший
     * спосіб це спитати, і єдиний, який бачить усе: насіння, порядок
     * подій, сортування модулів.
     */
    await login(page, '?artifact=reef#/login');
    const reef = page.locator('[data-reef-preview="ready"]');
    await expect(reef).toBeVisible({ timeout: 40_000 });
    const before = await readReef(reef);

    await page.reload();
    await expect(reef).toBeVisible({ timeout: 40_000 });
    const after = await readReef(reef);

    /*
     * Порівнюємо об'єкти цілком, а не поле за полем: перелік полів тут
     * один, і нове число, додане до сцени, потрапить під перевірку саме
     * тому, що його ніхто не згадав окремо.
     *
     * Час виконання й виклики малювання сюди НЕ входять — їх у `ReefFacts`
     * немає навмисно: зонд рантайму після перезавантаження прогрівається
     * заново, і його числа кажуть про раннер, а не про риф. Та сама межа,
     * що в `treeAcceptance.ts` про `build-ms`.
     */
    expect(after).toEqual(before);
  });
});
