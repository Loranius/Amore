// ============================================================
// Українські числівники.
// ------------------------------------------------------------
// Правило, заради якого це існує: наївне `n === 1 ? A : B` дає «3 міст»
// і «2 днів» — зламану мову там, де пара читає власні дані. Пастка —
// 11–14: за останньою цифрою вони просились би в другу форму, а
// потребують третьої.
// ============================================================
import { describe, expect, it } from 'vitest';
import { localDateFromISO, pluralUA, todayISO } from './utils';

const MISTO = ['місто', 'міста', 'міст'] as const;
const DEN = ['день', 'дні', 'днів'] as const;

describe('pluralUA', () => {
  it('одиниця бере першу форму', () => {
    expect(pluralUA(1, MISTO)).toBe('місто');
    expect(pluralUA(21, MISTO)).toBe('місто');
    expect(pluralUA(101, MISTO)).toBe('місто');
  });

  it('два-чотири беруть другу', () => {
    // Саме тут ламалось: було «3 міст» замість «3 міста».
    for (const n of [2, 3, 4, 22, 33, 44, 102]) expect(pluralUA(n, MISTO)).toBe('міста');
    expect(pluralUA(2, DEN)).toBe('дні');
  });

  it("п'ять і далі беруть третю", () => {
    for (const n of [0, 5, 6, 9, 10, 25, 100]) expect(pluralUA(n, MISTO)).toBe('міст');
  });

  it('11–14 беруть третю попри останню цифру', () => {
    // Головна пастка правила: 12 закінчується на 2, але це «12 міст».
    for (const n of [11, 12, 13, 14, 111, 112, 113, 114]) {
      expect(pluralUA(n, MISTO)).toBe('міст');
    }
  });

  it('нуль — третя форма', () => {
    expect(pluralUA(0, DEN)).toBe('днів');
  });

  it("від'ємні й дробові рахуються за цілою частиною модуля", () => {
    expect(pluralUA(-3, MISTO)).toBe('міста');
    expect(pluralUA(2.7, MISTO)).toBe('міста');
  });
});

describe('todayISO', () => {
  it('форматує локальну дату без зсуву в UTC', () => {
    expect(todayISO(new Date(2026, 6, 14))).toBe('2026-07-14');
    expect(todayISO(new Date(2024, 0, 1))).toBe('2024-01-01');
  });
});

describe('localDateFromISO', () => {
  it('розбирає дату локально — це календарний факт, а не мить у часі', () => {
    // Регресія: `new Date('2022-05-22')` у від'ємних зонах давало 21 травня.
    const d = localDateFromISO('2022-05-22');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2022, 4, 22]);
  });

  it('туди-назад із todayISO не зсуває день', () => {
    for (const iso of ['2026-01-01', '2026-07-14', '2026-12-31']) {
      expect(todayISO(localDateFromISO(iso))).toBe(iso);
    }
  });
});
