import { describe, expect, it } from 'vitest';
import {
  auraGlows,
  birthDuration,
  birthProgress,
  legProgress,
  pathReveal,
  revealStep,
  pulsePosition,
  starAura,
  starBreath,
  type AuraSource,
} from './constellationLife';

const REGULAR: AuraSource = { id: 3, level: 'regular', core: false, radius: 1.15 };
const IMPORTANT: AuraSource = { id: 4, level: 'important', core: false, radius: 1.55 };
const KEY: AuraSource = { id: 5, level: 'key', core: false, radius: 2 };
const CORE: AuraSource = { id: 1, level: 'key', core: true, radius: 2.8 };

describe('поява сузір’я — хронологічно й повільно (ADR-0214)', () => {
  /*
   * ВИМОГА ВЛАСНИКА: «при відкритті модуля спочатку загораються зірки
   * хронологічно від першої до останньої, повільно з'єднуючись між собою у
   * сузір'я». Черга: зірка → лінія до наступної → наступна спалахує, коли
   * лінія до неї дійшла.
   */
  const N = 10;
  const step = revealStep(N);

  it('повільно: на десять подій — секунда з лишком на кожну, а не 0.24 с', () => {
    expect(step).toBeGreaterThan(1);
    expect(birthDuration(N)).toBeGreaterThan(9);
  });

  it('довга історія не тягнеться хвилинами, коротка — не вічність на кожну', () => {
    expect(birthDuration(200)).toBeLessThan(80);
    expect(revealStep(200)).toBeGreaterThanOrEqual(0.35);
    expect(revealStep(2)).toBeLessThanOrEqual(1.3);
  });

  it('зірки загоряються строго за датою: кожна — пізніше за попередню', () => {
    for (let order = 1; order < N; order += 1) {
      const lit = (o: number) => {
        for (let t = 0; t < 30; t += 0.01) if (birthProgress(o, t, N) > 0) return t;
        return Infinity;
      };
      expect(lit(order)).toBeGreaterThan(lit(order - 1));
    }
  });

  it('зірка не існує до своєї черги й доростає до одиниці', () => {
    expect(birthProgress(3, 0, N)).toBe(0);
    expect(birthProgress(3, 3 * step - 0.01, N)).toBe(0);
    expect(birthProgress(3, 3 * step + 5, N)).toBe(1);
  });

  it('тривалість покриває останню зірку', () => {
    expect(birthProgress(N - 1, birthDuration(N), N)).toBeCloseTo(1, 9);
    expect(birthDuration(0)).toBe(0);
  });

  it('лінія рушає від уже запаленої зірки й доходить рівно тоді, коли наступна спалахує', () => {
    for (let leg = 0; leg < N - 1; leg += 1) {
      // Коли лінія рушила, її зірка вже світить.
      let started = Infinity;
      for (let t = 0; t < 30; t += 0.005) if (legProgress(leg, t, N) > 0) { started = t; break; }
      expect(birthProgress(leg, started, N)).toBeGreaterThan(0.4);
      // Наступна зірка ще темна, поки лінія не дійшла.
      expect(birthProgress(leg + 1, (leg + 1) * step - 0.01, N)).toBe(0);
      expect(legProgress(leg, (leg + 1) * step, N)).toBe(1);
    }
  });
});

describe('шлях прокладається слідом за зірками', () => {
  const ORDERS = [0, 1, 2, 3];

  it('порожній і одиничний ланцюг не мають шляху', () => {
    expect(pathReveal([], 5)).toBe(0);
    expect(pathReveal([0], 5)).toBe(0);
  });

  it('на початку шляху ще немає', () => {
    expect(pathReveal(ORDERS, 0)).toBe(0);
  });

  it('росте монотонно й ніколи не переганяє останню зірку', () => {
    let previous = -1;
    for (let clock = 0; clock <= 8; clock += 0.05) {
      const reveal = pathReveal(ORDERS, clock);
      expect(reveal).toBeGreaterThanOrEqual(previous);
      expect(reveal).toBeLessThanOrEqual(1);
      previous = reveal;
    }
    expect(pathReveal(ORDERS, birthDuration(4) + 1)).toBe(1);
  });

  it('частка ділиться на ПРОЛЬОТИ: зірка i лежить на i/(n−1)', () => {
    // Коли перший проліт дійшов, а другий ще не рушив, прокладено рівно третину.
    const step4 = revealStep(4);
    expect(pathReveal(ORDERS, step4)).toBeCloseTo(1 / 3, 9);
  });
});

describe('імпульс уздовж шляху', () => {
  it('на непрокладеному шляху його немає', () => {
    expect(pulsePosition(3, 0)).toBeLessThan(0);
  });

  it('іде від початку до кінця й зникає між проходами', () => {
    expect(pulsePosition(0, 1)).toBe(0);
    expect(pulsePosition(2.1, 1)).toBeCloseTo(0.5, 6);
    expect(pulsePosition(4.2, 1)).toBeCloseTo(1, 6);
    // Дев'ять секунд спокою з тринадцяти: імпульс — нагадування, не прикраса.
    expect(pulsePosition(6, 1)).toBeLessThan(0);
    expect(pulsePosition(12.9, 1)).toBeLessThan(0);
  });

  it('не виходить за прокладену частину шляху', () => {
    for (let clock = 0; clock < 26; clock += 0.13) {
      expect(pulsePosition(clock, 0.4)).toBeLessThanOrEqual(0.4 + 1e-9);
    }
  });

  it('повторюється: та сама секунда — те саме місце', () => {
    expect(pulsePosition(2.5, 1)).toBeCloseTo(pulsePosition(2.5 + 13, 1), 9);
  });
});

describe('ієрархія тримається не лише на кольорі', () => {
  it('що важливіша подія, то ширший ореол і сильніше сяйво', () => {
    expect(starAura(REGULAR).halo).toBeLessThan(starAura(IMPORTANT).halo);
    expect(starAura(IMPORTANT).halo).toBeLessThan(starAura(KEY).halo);
    expect(starAura(REGULAR).glow).toBeLessThan(starAura(IMPORTANT).glow);
    expect(starAura(IMPORTANT).glow).toBeLessThan(starAura(KEY).glow);
  });

  it('ядро світить сильніше за будь-яку ключову подію', () => {
    expect(starAura(CORE).glow).toBeGreaterThan(starAura(KEY).glow);
  });

  it('що більша зірка, то повільніше й глибше вона дихає', () => {
    // Велике тіло не може мерехтіти, як іскра, — саме це й читається як вага.
    expect(starAura(KEY).rate).toBeLessThan(starAura(REGULAR).rate);
    expect(starAura(KEY).breath).toBeGreaterThan(starAura(REGULAR).breath);
    expect(starAura(CORE).rate).toBeLessThan(starAura(KEY).rate);
  });

  it('дихання лишається дрібним: це не пульсація, а життя', () => {
    for (const star of [REGULAR, IMPORTANT, KEY, CORE]) {
      const aura = starAura(star);
      for (let clock = 0; clock < 20; clock += 0.07) {
        const size = starBreath(aura, clock);
        expect(size).toBeGreaterThan(0.9);
        expect(size).toBeLessThan(1.1);
      }
    }
  });

  it('сузір’я не дихає в такт', () => {
    const phases = [1, 2, 3, 4, 5, 6, 7].map((id) => starAura({ ...REGULAR, id }).phase);
    expect(new Set(phases.map((phase) => phase.toFixed(3))).size).toBe(phases.length);
  });

  it('фаза виводиться з id, тож задня подія нікому не збиває дихання', () => {
    expect(starAura({ ...REGULAR, id: 42 }).phase)
      .toBe(starAura({ ...KEY, id: 42 }).phase);
  });

  it('масив сяйва йде в тому ж порядку, що й зірки', () => {
    const glows = auraGlows([REGULAR, KEY, CORE]);
    expect(glows).toHaveLength(3);
    expect(glows[0]).toBeCloseTo(starAura(REGULAR).glow, 6);
    expect(glows[1]).toBeCloseTo(starAura(KEY).glow, 6);
    expect(glows[2]).toBeCloseTo(starAura(CORE).glow, 6);
  });
});
