import { describe, expect, it } from 'vitest';
import { hslToRgb } from './journeyPalette';
import {
  coreColour,
  HALO_TINT_GAIN,
  shadeHue,
  starColour,
  starSeed,
  starShade,
  starShadeOf,
  STAR_COLOR_TOKENS,
  STAR_FAMILIES,
} from './starPalette';
import type { ConstellationLevel } from './constellationRules';

const LEVELS: ConstellationLevel[] = ['regular', 'important', 'key'];

describe('три родини', () => {
  it('у кожного рівня своя родина щонайменше з п’яти відтінків', () => {
    for (const level of LEVELS) {
      expect(STAR_FAMILIES[level].length).toBeGreaterThanOrEqual(5);
    }
  });

  it('токени унікальні на весь перелік', () => {
    expect(new Set(STAR_COLOR_TOKENS).size).toBe(STAR_COLOR_TOKENS.length);
  });

  it('смуги тонів родин НЕ перетинаються', () => {
    /*
     * Головна вимога до палітри: рівень мусить читатись кольором навіть тоді,
     * коли відтінок обрала пара. Якби родини перекривались, «важлива» й
     * «звичайна» могли б вийти того самого тону, і одна з чотирьох ознак
     * рівня зникла б.
     */
    const bands = LEVELS.map((level) => {
      const hues = STAR_FAMILIES[level].map(shadeHue);
      return { level, low: Math.min(...hues), high: Math.max(...hues) };
    });
    for (const a of bands) {
      for (const b of bands) {
        if (a.level === b.level) continue;
        expect(a.high < b.low || b.high < a.low).toBe(true);
      }
    }
  });

  it('між сусідніми смугами лишається розрив, а не дотик', () => {
    const sorted = LEVELS
      .map((level) => STAR_FAMILIES[level].map(shadeHue))
      .map((hues) => ({ low: Math.min(...hues), high: Math.max(...hues) }))
      .sort((a, b) => a.low - b.low);
    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index]!.low - sorted[index - 1]!.high).toBeGreaterThanOrEqual(30);
    }
  });

  it('кожен відтінок — розбірний HSL у межах 0…1 після переводу', () => {
    for (const level of LEVELS) {
      for (const shade of STAR_FAMILIES[level]) {
        for (const channel of hslToRgb(shade.colour)) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('кольори, які власник обрав раніше, лишились у палітрі', () => {
    // Бірюза звичайної події й золото ключової були в модулі до появи родин;
    // втратити їх означало б втратити впізнаваність неба.
    expect(STAR_FAMILIES.regular[0]!.colour).toBe('hsl(184 76% 58%)');
    expect(STAR_FAMILIES.key[0]!.colour).toBe('hsl(44 92% 62%)');
  });

  it('жоден відтінок не вимивається в біле під ореолом', () => {
    /*
     * Знайдено ЛИШЕ живим екраном, і вже вдруге в цьому модулі.
     *
     * Ореол малюється додатковим змішуванням поверх туманності, яка вже
     * світиться, і перед цим відтінок множиться на `HALO_TINT_GAIN`. Якщо
     * після множника переходить одиницю НАЙТЕМНІШИЙ канал, білими стають усі
     * три — тон зникає повністю. Перша редакція родин мала перлину на 84%
     * світлості й кригу на 74%: з восьми зірок пари шість вийшли білими.
     *
     * Міряється саме найтемніший канал: два світлих можуть і мусять
     * насичуватись — це і є світло. Тон живе в різниці між ними й третім.
     */
    for (const level of LEVELS) {
      for (const shade of STAR_FAMILIES[level]) {
        const darkest = Math.min(...hslToRgb(shade.colour));
        expect(darkest * HALO_TINT_GAIN).toBeLessThan(0.92);
      }
    }
  });

  it('стеля тримається й на ядрі, якому світлість піднімають', () => {
    for (const level of LEVELS) {
      for (const shade of STAR_FAMILIES[level]) {
        const darkest = Math.min(...hslToRgb(coreColour(shade.colour)));
        expect(darkest * HALO_TINT_GAIN).toBeLessThan(1);
      }
    }
  });

  it('жоден відтінок не сірий: колір мусить лишатись кольором', () => {
    for (const level of LEVELS) {
      for (const shade of STAR_FAMILIES[level]) {
        const [r, g, b] = hslToRgb(shade.colour);
        expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(0.05);
      }
    }
  });
});

describe('насіння', () => {
  it('той самий id — та сама варіація, завжди', () => {
    expect(starSeed(42)).toBe(starSeed(42));
  });

  it('сусідні id не дають сусідніх чисел', () => {
    // Без фіналізатора хешу події 12 і 13 діставали б сусідні відтінки
    // родини, і пара бачила б градієнт замість розмаїття.
    expect(Math.abs(starSeed(12) - starSeed(13))).toBeGreaterThan(0.05);
  });

  it('лишається в межах 0…1', () => {
    for (let id = 1; id <= 500; id += 1) {
      expect(starSeed(id)).toBeGreaterThanOrEqual(0);
      expect(starSeed(id)).toBeLessThan(1);
    }
  });

  it('розкидає по всій родині, а не по двох відтінках', () => {
    const used = new Set<string>();
    for (let id = 1; id <= 200; id += 1) {
      used.add(starShadeOf({ id, level: 'regular' }).token);
    }
    expect(used.size).toBe(STAR_FAMILIES.regular.length);
  });
});

describe('колір зірки', () => {
  it('без вибору пари бере відтінок СВОЄЇ родини', () => {
    for (const level of LEVELS) {
      const tokens = STAR_FAMILIES[level].map((shade) => shade.token);
      for (let id = 1; id <= 40; id += 1) {
        expect(tokens).toContain(starShadeOf({ id, level }).token);
      }
    }
  });

  it('вибір пари має пріоритет над рекомендованим', () => {
    const chosen = starShadeOf({ id: 7, level: 'regular', starColor: 'magenta' });
    expect(chosen.token).toBe('magenta');
    expect(starColour({ id: 7, level: 'regular', starColor: 'magenta' }))
      .toBe(STAR_FAMILIES.important[3]!.colour);
  });

  it('невідомий токен не ламає зірку — вона просто бере своє', () => {
    /*
     * Токен приходить із бази, і `CHECK` там уже стереже перелік. Але сцена
     * не має права впасти на рядку, який хтось поклав повз форму — вона
     * малюється щокадру, і виняток тут забрав би всю сцену.
     */
    expect(starShade('#b06bff')).toBeNull();
    expect(starShadeOf({ id: 3, level: 'key', starColor: 'нічого-такого' }).token)
      .toBe(starShadeOf({ id: 3, level: 'key' }).token);
    expect(starShadeOf({ id: 3, level: 'key', starColor: null }).token)
      .toBe(starShadeOf({ id: 3, level: 'key' }).token);
  });
});

describe('ядро', () => {
  it('світліше за свій відтінок, але того самого тону', () => {
    // Робиться підняттям світлості, а не білим: біле забрало б тон, і ядро
    // вийшло б безбарвним — рівно те, що вже сталось із усіма зірками, коли
    // біле підмішувалось по всьому силуету.
    const base = 'hsl(44 92% 62%)';
    const core = coreColour(base);
    const luminance = (rgb: number[]) => 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
    expect(luminance(hslToRgb(core))).toBeGreaterThan(luminance(hslToRgb(base)));
    expect(shadeHue({ token: '', label: '', colour: core })).toBe(44);
  });

  it('не переходить у білий навіть на найсвітлішому відтінку', () => {
    const core = coreColour('hsl(206 34% 84%)');
    const [r, g, b] = hslToRgb(core);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(0.03);
  });
});
