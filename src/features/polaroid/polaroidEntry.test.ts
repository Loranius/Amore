import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * ВИМОГА (ADR-0181), словами власника: «додай завантаження фото полароїда
 * в спогади».
 *
 * ЩО САМЕ ТУТ СТЕРЕЖЕТЬСЯ І ЧОМУ ЧИТАННЯМ КОДУ. ADR-0180 прибрав менеджер
 * фото з налаштувань і НАЗВАВ ціну: разом із ним пішла єдина дорога, якою
 * в бакет `family_photos` потрапляли нові фото, тобто грань «Фотографії»
 * кристала перестала рости. Ця зміна ту ціну закриває — і мусить лишатись
 * закритою.
 *
 * Обидві половини ламаються ТИХО:
 *
 *   1. Вхід. Модуль без входу — це код, якого пара ніколи не побачить.
 *      Складання від цього не падає.
 *   2. Бакет і КОРІНЬ. Рушій читає `family_photos` через `list('')`
 *      (`home/useHome.ts::usePhotoPool`) і бере дату з `created_at`
 *      Storage. Файл, покладений в іншу папку чи в інший бакет,
 *      завантажиться успішно, покажеться в цьому ж аркуші — і НЕ
 *      потрапить ні на острів, ні в кристал. Помилка без жодної ознаки.
 */

const SRC = join(__dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

const page = read('features', 'memories', 'MemoriesPage.tsx');
const hooks = read('features', 'polaroid', 'usePolaroid.ts');
const sheet = read('features', 'polaroid', 'PolaroidSheet.tsx');

describe('вхід у полароїд', () => {
  it('стоїть у «Спогадах»', () => {
    expect(page).toContain('PolaroidSheet');
    expect(page).toContain("from '@/features/polaroid/PolaroidSheet'");
  });

  it('входить дією заголовка, а не третьою плаваючою кнопкою', () => {
    /*
     * Унизу «Спогадів» рівно дві плаваючі кнопки, і вони дзеркальні:
     * карта ліворуч, «+» праворуч. Третя зламала б саме ту симетрію,
     * якою екран читається з одного погляду, а `PageHeader` тримає рівно
     * одну дію — і в «Спогадах» вона доти була вільна.
     */
    expect(page).toContain('mm-polaroid-open');
    const fabs = page.split('className="fab').length - 1;
    expect(fabs).toBe(2);
  });
});

describe('фото лягає туди, звідки його читає рушій', () => {
  it('бакет той самий, що в пулі кристала', () => {
    // Якщо ці два рядки розійдуться, завантаження працюватиме, аркуш
    // показуватиме порожньо, а кристал не побачить жодного нового фото.
    const home = read('features', 'home', 'useHome.ts');
    expect(hooks).toContain("POLAROID_BUCKET = 'family_photos'");
    expect(home).toContain("PHOTO_BUCKET = 'family_photos'");
  });

  it('лягає в КОРІНЬ бакета, без папки в імені', () => {
    /*
     * `usePhotoPool` читає `list('')` — тобто лише корінь. Файл у папці
     * туди не потрапляє: саме цим профіль і ховає портрети від
     * полароїда (ADR-0180 §5). Тут та сама межа працює у зворотний бік.
     */
    const name = /const name = `([^`]+)`/.exec(hooks)?.[1];
    expect(name).toBeDefined();
    expect(name).not.toContain('/');
  });

  it('ім’я файлу не може зіткнутись із сусіднім', () => {
    // Мультизавантаження вибирає файли в одну мілісекунду, тож самого
    // `Date.now()` не досить: другий файл затер би перший. Причина кидка
    // монети названа в `lib/entropy.ts`, як вимагає CLAUDE.md.
    expect(hooks).toContain('randomToken()');
    expect(hooks).toContain("from '@/lib/entropy'");
  });

  it('не перезаписує наявне фото', () => {
    // `upsert: false` — друга половина того ж захисту: навіть при збігу
    // імені Storage відмовить, а не проковтне чуже фото.
    expect(hooks).toContain('upsert: false');
  });
});

describe('список і пул скидаються разом', () => {
  it('ключ списку ділить префікс із `qk.photos()`', () => {
    /*
     * Інакше після завантаження аркуш показував би нове фото, а кристал
     * ще десять хвилин — старий пул (`staleTime` там 10 хв). Розбіжність
     * між двома екранами, яку ніхто не пов'яже з причиною.
     */
    expect(hooks).toContain("queryKey: [...qk.photos(), 'manager']");
    expect(hooks).toContain('invalidateQueries({ queryKey: qk.photos() })');
  });
});

describe('аркуш каже, чим полароїд відрізняється від спогаду', () => {
  it('перший рядок називає наслідок', () => {
    /*
     * Вони тепер за одну кнопку один від одного, і питання «а куди це
     * піде?» виникає одразу. Рядок мусить сказати і КУДИ (на острів), і
     * чого НЕ вимагається — бо від спогаду вимагається назва з датою.
     */
    expect(sheet).toContain('на острові');
    expect(sheet).toMatch(/Ні назви, ні дати/);
  });

  it('видалення питає, бо воно остаточне', () => {
    // Файл іде зі сховища, і скасувати його нічим.
    expect(sheet).toContain('confirmDialog(');
  });

  it('мініатюра просить у сховища свій розмір', () => {
    /*
     * Правило `components/ui/photoThumbRule.test.ts`: сирий `<img>` тягне
     * ОРИГІНАЛ — у пари в середньому 416 КБ на знімок при 21 КБ, яких
     * вистачає на картку. Число ширини мусить збігатися з сіткою в CSS,
     * інакше сховище віддає не той розмір, і помітити це можна лише в
     * мережевій панелі.
     */
    const css = read('features', 'polaroid', 'polaroid.css');
    const inCode = /THUMB_CSS_PX = (\d+)/.exec(sheet)?.[1];
    const inCss = /minmax\((\d+)px/.exec(css)?.[1];
    expect(inCode).toBeDefined();
    expect(inCss).toBeDefined();
    // Сітка `auto-fill, minmax(N, 1fr)` розтягує картку ВІД N; просимо
    // стелю, а не підлогу, тож число в коді має бути більшим.
    expect(Number(inCode)).toBeGreaterThan(Number(inCss));
  });
});
