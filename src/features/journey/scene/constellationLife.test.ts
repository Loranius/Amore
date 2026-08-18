import { describe, expect, it } from 'vitest';
import {
  auraGlows,
  birthDuration,
  birthProgress,
  pathReveal,
  pathSegments,
  pulsePosition,
  starAura,
  starBreath,
  type AuraSource,
} from './constellationLife';

const REGULAR: AuraSource = { id: 3, level: 'regular', core: false, radius: 1.15 };
const IMPORTANT: AuraSource = { id: 4, level: 'important', core: false, radius: 1.55 };
const KEY: AuraSource = { id: 5, level: 'key', core: false, radius: 2 };
const CORE: AuraSource = { id: 1, level: 'key', core: true, radius: 2.8 };

describe('поява сузір’я', () => {
  it('зірка не існує до своєї черги й доростає до одиниці', () => {
    expect(birthProgress(3, 0)).toBe(0);
    expect(birthProgress(3, 0.71)).toBe(0);
    expect(birthProgress(3, 3)).toBe(1);
  });

  it('тривалість покриває останню зірку', () => {
    expect(birthProgress(9, birthDuration(10))).toBeCloseTo(1, 9);
    expect(birthDuration(0)).toBe(0);
  });
});

describe('шлях прокладається слідом за зірками', () => {
  /*
   * Вимога: промінь тягнеться до зірки рівно так само, як вона народжується.
   * Інакше він на мить висить у порожнечі попереду неї — це вже було видно на
   * пласкій версії.
   */
  const ORDERS = [0, 1, 2, 3];

  it('порожній і одиничний ланцюг не мають шляху', () => {
    expect(pathReveal([], 5)).toBe(0);
    expect(pathReveal([0], 5)).toBe(0);
  });

  it('на початку шляху ще немає', () => {
    expect(pathReveal(ORDERS, 0)).toBe(0);
  });

  it('росте разом із появою й ніколи не переганяє останню зірку', () => {
    let previous = -1;
    for (let clock = 0; clock <= 4; clock += 0.05) {
      const reveal = pathReveal(ORDERS, clock);
      expect(reveal).toBeGreaterThanOrEqual(previous);
      expect(reveal).toBeLessThanOrEqual(1);
      previous = reveal;
    }
    expect(pathReveal(ORDERS, 4)).toBe(1);
  });

  it('частка ділиться на ПРОЛЬОТИ, а не на зірки', () => {
    // `TubeGeometry` кладе `uv.x` рівномірно за параметром, тож контрольна
    // точка i лежить на i/(n−1) — на чотирьох зірках це три прольоти. Якби
    // тут стояла кількість зірок, шлях не доростав би до останньої взагалі.
    //
    // Мить обрано так, щоб рости встигла лише друга зірка: перший проліт іде
    // рівно за нею.
    const clock = 0.4;
    expect(birthProgress(2, clock)).toBe(0);
    expect(pathReveal(ORDERS, clock)).toBeCloseTo(birthProgress(1, clock) / 3, 9);
  });
});

describe('бюджет шляху', () => {
  /*
   * Кількість подій у пари росте роками й нічим не обмежена. Без стелі сорок
   * подій дали б 546 відрізків труби, сто — 1386, і геометрія шляху почала б
   * коштувати більше за все інше в сцені разом.
   */
  it('одна подія й порожнеча не будують нічого', () => {
    expect(pathSegments(0)).toBe(0);
    expect(pathSegments(1)).toBe(0);
  });

  it('звичайній парі вистачає прольотів, а не стелі', () => {
    expect(pathSegments(8)).toBe(98);
  });

  it('стеля не пробивається жодною кількістю подій', () => {
    for (const count of [40, 100, 1000, 10_000]) {
      expect(pathSegments(count)).toBeLessThanOrEqual(420);
    }
  });

  it('до стелі росте, після — не росте взагалі', () => {
    expect(pathSegments(20)).toBeLessThan(pathSegments(21));
    expect(pathSegments(200)).toBe(pathSegments(2000));
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
