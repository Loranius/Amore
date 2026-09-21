import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * РЕГРЕСІЯ НА ТИХИЙ ЗАПАСНИЙ ШЛЯХ У ЗАВАНТАЖЕННІ ФОТО (ADR-0203).
 *
 * Аудит 2026-09-20 §4.1: усі три шляхи завантаження тиснули фото до
 * ≤1600 px, але при невдачі стиснення мовчки лили в сховище ОРИГІНАЛ,
 * пишучи про це лише `console.warn`. Пара не бачила нічого.
 *
 * Ціна: знімок 6144×8160 (50 Мпікс, 11.4 МБ) Supabase відмовляється
 * трансформувати — «The source image resolution is too large to process»,
 * — тож кожен його показ коштував рятівного декодування в `Photo.tsx`,
 * де браузер розпаковує всі 50 мегапікселів заради кадру 96 пікселів
 * завширшки. `CLAUDE.md` забороняє це прямо: «no silent fallbacks».
 *
 * Тест дивиться в текст, за тим самим підходом, що й `Photo.test.ts` і
 * `noRawRandom.test.ts`: рантайм тут — canvas і `createImageBitmap`,
 * яких у середовищі `node` немає. Вада ж була ОДНА, розтиражована в три
 * файли, тож сторож мусить дивитись на всі три.
 */
const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const IMAGES = read('./images.ts');

/** Три місця, де портал кладе фото в сховище. */
const UPLOADERS: ReadonlyArray<readonly [string, string]> = [
  ['спогади', read('../features/memories/useMemories.ts')],
  ['полароїд', read('../features/polaroid/usePolaroid.ts')],
  ['мітки на карті', read('../features/memories/useMapPins.ts')],
];

describe('стиснення не здається мовчки', () => {
  it('невдача головного шляху веде до ДРУГОГО декодера, а не до оригіналу', () => {
    expect(IMAGES).toContain('compressViaBitmap(normalized, maxSide, quality)');
  });

  it('другий декодер просить ОДНУ сторону — дві вбивають пропорції', () => {
    /*
     * Виміряно на ЦЬОМУ модулі в справжньому Chromium (Vite віддає
     * `images.ts` як ES-модуль, сторінка кличе справжній `compress`, а
     * головний декодер зламано підміною `window.Image`):
     *
     *   200×100 → 1600×800    пропорції цілі
     *   100×200 → 800×1600    довгу сторону доводить полотно
     *
     * З двома сторонами обидва дали б 1600×1600. Та сама вада, що
     * знайшлась у `Photo.tsx`; тут її не повторюємо.
     */
    expect(IMAGES).toContain('resizeWidth: maxSide');
    expect(IMAGES).not.toContain('resizeHeight:');
    expect(IMAGES, 'довгу сторону доводить полотно').toContain('if (h > maxSide)');
  });

  it('орієнтація задається явно, а не залежить від версії браузера', () => {
    expect(IMAGES).toContain("imageOrientation: 'from-image'");
  });

  it('файл не роздувається в base64 дорогою до декодера', () => {
    /*
     * `readAsDataURL` робить із 11 МБ рядок на ~14.5 МБ, який мусить
     * лежати в пам'яті ПОРУЧ із розпакованим растром — тобто найдорожчий
     * можливий спосіб саме там, де пам'яті й бракує.
     */
    expect(IMAGES).toContain('URL.createObjectURL(normalized)');
    expect(IMAGES, 'створений URL треба відкликати').toContain('URL.revokeObjectURL(url)');
    /*
     * Одне вживання лишається — у `normalizeToPreview`, і воно законне:
     * там data URL віддається як миттєве прев'ю ще до завантаження, і
     * відкликати його не треба. Тому не «жодного», а «рівно одне»: інакше
     * тест або забороняв би чуже, або пропускав би повернення старого
     * шляху в `compress`.
     */
    expect(IMAGES.match(/readAsDataURL/g) ?? []).toHaveLength(1);
  });
});

describe('жоден шлях завантаження не ллє оригінал', () => {
  /*
   * Підпис вади: `let blob: Blob = <оригінал>` — змінна, заведена саме
   * для того, щоб `catch` міг лишити її недоторканою. Поки її немає,
   * немає і куди відкотитись мовчки.
   */
  const MUTABLE_BLOB = /let\s+blob\b/;

  for (const [name, source] of UPLOADERS) {
    it(`${name}: немає змінної, у яку можна відкотити оригінал`, () => {
      expect(MUTABLE_BLOB.test(source), `${name}: знайдено \`let blob\``).toBe(false);
    });
  }

  it('сам сторож щось ловить', () => {
    // Без цього зелений тест вище нічого не доводить.
    expect(MUTABLE_BLOB.test('  let blob: Blob = normalized;')).toBe(true);
    expect(MUTABLE_BLOB.test('  const { blob } = await compress(file);')).toBe(false);
  });

  it('мітка на карті більше не ковтає помилку мовчки', () => {
    const pins = UPLOADERS[2]![1];
    /*
     * Тут було три проковтнуті помилки поспіль, і всі три віддавали
     * `null`: невдалий HEIC, невдале стиснення, невдале завантаження.
     * Викликач бачив `null` і йшов далі, тож мітка зберігалась без фото
     * й без жодного слова парі.
     */
    expect(pins).toContain('uploadPinPhoto(file: File, pinId: number): Promise<string>');
    expect(pins, 'падіння фото не має вдавати, що місце не збереглося')
      .toContain('Місце збережено, але фото не вдалося підготувати');
  });
});
