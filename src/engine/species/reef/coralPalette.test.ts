import { describe, expect, it } from 'vitest';
import { reefCoupleHue, reefCoupleTint, type ReefTheme, reefColonyTint } from './coralPalette';

// ============================================================
// Колір коралу: пара дає відтінок, тема дає світлість.
// ------------------------------------------------------------
// Ті самі пастки, що вже спрацювали на кристалі, тільки з іншої дуги.
// ============================================================

/** Ґрунти обох тем рифа з `DESIGN.md`. */
const GROUND: Readonly<Record<ReefTheme, string>> = {
  dark: '#070a12',
  light: '#ecf8f8',
};

const hex = (value: string): [number, number, number] =>
  [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16) / 255) as [number, number, number];
const channel = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (rgb: readonly number[]): number =>
  0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!);
const contrast = (a: readonly number[], b: readonly number[]): number => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
};

const DATES = (() => {
  const out: string[] = [];
  for (let year = 2016; year < 2027; year += 1) {
    for (const month of ['01', '04', '07', '10']) out.push(`${year}-${month}-15`);
  }
  return out;
})();

describe('колір належить парі', () => {
  it('та сама дата — той самий відтінок, назавжди', () => {
    expect(reefCoupleHue('2022-12-26')).toBe(reefCoupleHue('2022-12-26'));
    expect(reefCoupleTint('2022-12-26', 'dark')).toEqual(reefCoupleTint('2022-12-26', 'dark'));
  });

  it('палітра не вироджена, і сусідні відтінки видно оком', () => {
    /*
     * Формулювання, якого навчив кристал: «різні дати — різні кольори»
     * НЕПРАВДА за побудовою, бо щаблів шість, а дат безліч. Правда, яку
     * варто стерегти, інша — палітра справді розходиться по дузі.
     */
    const hues = new Set(DATES.map((date) => reefCoupleHue(date)));
    expect(hues.size, 'палітра вироджена').toBeGreaterThanOrEqual(5);
  });

  it('жоден відтінок не виходить із теплої родини', () => {
    /*
     * Межа, яку на кристалі довелось ставити після того, як повне коло
     * дало парі тіло поза родиною порталу. Дуга 350°→35° перетинає
     * нуль, тож «у родині» означає «або за 350, або до 35».
     */
    for (const date of DATES) {
      const hue = reefCoupleHue(date)!;
      const warm = hue >= 350 || hue <= 35;
      expect(warm, `${date}: відтінок ${hue}° поза дугою`).toBe(true);
    }
  });

  it('порожня дата дає знебарвлений корал, а не вигаданий колір', () => {
    for (const theme of ['dark', 'light'] as const) {
      expect(reefCoupleHue('')).toBeNull();
      const bleached = reefCoupleTint('   ', theme).rgb;
      // Знебарвлений — це майже сірий: канали поруч.
      expect(Math.max(...bleached) - Math.min(...bleached)).toBeLessThan(0.06);
    }
  });
});

describe('світлість належить темі, і це вимір', () => {
  it('у кожній темі корал видно на ЇЇ ґрунті', () => {
    /*
     * Головне число цього файлу. Виміряно наперед: єдина світлість, що
     * влаштовує обидва ґрунти, дає посередні 3.07 туди й туди, а
     * розділення за темою — 5.60 і 4.03.
     */
    for (const theme of ['dark', 'light'] as const) {
      const ground = hex(GROUND[theme]);
      for (const date of DATES) {
        const tint = reefCoupleTint(date, theme).rgb;
        expect(
          contrast(tint, ground),
          `${theme}, ${date}: корал зливається з ґрунтом`,
        ).toBeGreaterThan(3.5);
      }
    }
  });

  it('темна тема дає світліший корал, ніж світла', () => {
    // Не косметика: два ґрунти тягнуть у протилежні боки, і саме тому
    // світлість не може бути одна на обидві теми.
    for (const date of DATES.slice(0, 8)) {
      const onDark = luminance(reefCoupleTint(date, 'dark').rgb);
      const onLight = luminance(reefCoupleTint(date, 'light').rgb);
      expect(onDark, date).toBeGreaterThan(onLight);
    }
  });

  it('це один колір у двох темах, а не два різні', () => {
    /*
     * Відтінок належить парі й не має права поповзти між темами —
     * інакше «індивідуальний колір» перетворюється на «колір теми».
     */
    for (const date of DATES.slice(0, 8)) {
      const dark = reefCoupleTint(date, 'dark').rgb;
      const light = reefCoupleTint(date, 'light').rgb;
      // Порядок каналів той самий: червоний провідний в обох.
      expect(dark.indexOf(Math.max(...dark)), date).toBe(light.indexOf(Math.max(...light)));
      expect(dark.indexOf(Math.min(...dark)), date).toBe(light.indexOf(Math.min(...light)));
    }
  });

  it('корал лишається кольоровим, а не сірим', () => {
    // Провідний канал мусить помітно переважати — інакше це камінь.
    for (const theme of ['dark', 'light'] as const) {
      for (const date of DATES.slice(0, 12)) {
        const rgb = reefCoupleTint(date, theme).rgb;
        expect(Math.max(...rgb) - Math.min(...rgb), `${theme} ${date}`).toBeGreaterThan(0.12);
      }
    }
  });
});

describe('вибілений рік БЛІДНЕ, а не темніє', () => {
  /*
   * ВИМОГА (ADR-0182): бідний рік читається вибіленим, «як справжній
   * корал під стресом».
   *
   * ЦЕЙ БЛОК НАРОДИВСЯ З ВАДИ, яка прожила в порталі непоміченою саме
   * тому, що коментар поруч із нею описував НАМІР, а не дію. Сцена
   * рахувала колір колонії множенням RGB на скаляр
   * (`multiplyScalar(0.55 + 0.45 * fill)`), а множення всіх трьох
   * каналів на одне число лишає насиченість недоторканою й знижує лише
   * яскравість. Бідний рік ставав ТЕМНИМ — і зливався з головою, яка
   * теж темна: контраст 1.58 у темній темі й 1.06 у світлій, тобто «не
   * видно взагалі».
   *
   * Тому тут перевіряється не «колір змінився», а сама ВІСЬ зміни.
   */
  const saturation = (rgb: readonly number[]): number => {
    const max = Math.max(...rgb);
    return max === 0 ? 0 : 1 - Math.min(...rgb) / max;
  };
  const lightness = (rgb: readonly number[]): number =>
    (Math.max(...rgb) + Math.min(...rgb)) / 2;

  it('насиченість падає з наповненістю', () => {
    for (const theme of ['dark', 'light'] as const) {
      const base = reefCoupleTint('2022-12-26', theme);
      const full = saturation(reefColonyTint(base, 1).rgb);
      const half = saturation(reefColonyTint(base, 0.5).rgb);
      const empty = saturation(reefColonyTint(base, 0).rgb);
      expect(full, theme).toBeGreaterThan(half);
      expect(half, theme).toBeGreaterThan(empty);
    }
  });

  it('СВІТЛІСТЬ не рухається — її міряли окремо й під кожну тему', () => {
    /*
     * Саме це й ламало попередню редакцію. Світлість підібрана так, щоб
     * корал було видно на ґрунті СВОЄЇ теми (0.62 у темній, 0.36 у
     * світлій); вибілювання, яке її зрушує, руйнує той вимір.
     *
     * Зсув до сірого `(max + min) / 2` зберігає суму max і min, тобто
     * світлість HSL точно. Зсув до середнього каналів або до білого —
     * ні, і тому їх тут немає.
     */
    for (const theme of ['dark', 'light'] as const) {
      const base = reefCoupleTint('2022-12-26', theme);
      const expected = lightness(base.rgb);
      for (const fill of [0, 0.25, 0.5, 0.75, 1]) {
        expect(lightness(reefColonyTint(base, fill).rgb), `${theme} ${fill}`)
          .toBeCloseTo(expected, 5);
      }
    }
  });

  it('повний рік — той самий піксель, що й колір пари', () => {
    // Вибілювання чіпає лише бідні роки. Повний рік мусить лишитись
    // рівно кольором пари, інакше зміна тихо перефарбувала б увесь риф.
    for (const theme of ['dark', 'light'] as const) {
      const base = reefCoupleTint('2022-12-26', theme);
      expect(reefColonyTint(base, 1).rgb).toEqual(base.rgb);
    }
  });

  it('порожній рік не стає каменем', () => {
    // Геть сірий рік читався б породою, а не збіднілим коралом. Підлога
    // насиченості лишає слід відтінку.
    for (const theme of ['dark', 'light'] as const) {
      const base = reefCoupleTint('2022-12-26', theme);
      expect(saturation(reefColonyTint(base, 0).rgb), theme).toBeGreaterThan(0.1);
    }
  });

  it('знебарвлена пара (без дати) лишається знебарвленою на всіх роках', () => {
    // Пара без дати вже сіра; вибілювання не має права вигадати їй колір.
    for (const theme of ['dark', 'light'] as const) {
      const base = reefCoupleTint('', theme);
      for (const fill of [0, 0.5, 1]) {
        expect(saturation(reefColonyTint(base, fill).rgb), `${theme} ${fill}`)
          .toBeLessThan(0.12);
      }
    }
  });

  it('негодяща наповненість не валить колір', () => {
    const base = reefCoupleTint('2022-12-26', 'dark');
    for (const fill of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2]) {
      for (const channel of reefColonyTint(base, fill).rgb) {
        expect(Number.isFinite(channel), String(fill)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});
