import { describe, expect, it } from 'vitest';
import { reefCoupleHue, reefCoupleTint, type ReefTheme } from './coralPalette';

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
