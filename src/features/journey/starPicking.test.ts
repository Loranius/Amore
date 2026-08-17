import { describe, expect, it } from 'vitest';
import { pickStar, TOUCH_TARGET, type ScreenStar } from './starPicking';

function star(overrides: Partial<ScreenStar> & { id: number }): ScreenStar {
  return { x: 0, y: 0, radius: 6, visible: true, ...overrides };
}

describe('pickStar', () => {
  it('порожнє небо не дає нікого', () => {
    expect(pickStar([], { x: 10, y: 10 })).toBeNull();
  });

  it('точне влучення обирає зірку', () => {
    expect(pickStar([star({ id: 4, x: 100, y: 200 })], { x: 100, y: 200 })).toBe(4);
  });

  it('дотик поруч теж рахується — ціль не менша за палець', () => {
    // Дрібна зірка на шість пікселів: без запасу в неї було б не влучити.
    const stars = [star({ id: 4, x: 100, y: 200, radius: 6 })];
    expect(pickStar(stars, { x: 100 + TOUCH_TARGET - 1, y: 200 })).toBe(4);
  });

  it('дотик далеко нікого не обирає', () => {
    const stars = [star({ id: 4, x: 100, y: 200, radius: 6 })];
    expect(pickStar(stars, { x: 100 + TOUCH_TARGET + 5, y: 200 })).toBeNull();
  });

  it('велика зірка ловить із більшої відстані, ніж дрібна', () => {
    // Сяйво навколо великої зірки пара сприймає як саму зірку.
    const big = [star({ id: 1, x: 0, y: 0, radius: 40 })];
    expect(pickStar(big, { x: 70, y: 0 })).toBe(1);
    const small = [star({ id: 1, x: 0, y: 0, radius: 4 })];
    expect(pickStar(small, { x: 70, y: 0 })).toBeNull();
  });

  it('між двома влучними береться ближча до пальця', () => {
    const stars = [
      star({ id: 1, x: 100, y: 100 }),
      star({ id: 2, x: 108, y: 100 }),
    ];
    expect(pickStar(stars, { x: 106, y: 100 })).toBe(2);
    expect(pickStar(stars, { x: 101, y: 100 })).toBe(1);
  });

  it('зірка за спиною камери не ловить нічого', () => {
    const stars = [star({ id: 1, x: 100, y: 100, visible: false })];
    expect(pickStar(stars, { x: 100, y: 100 })).toBeNull();
  });

  it('невидиму не обирає навіть коли вона ближча за видиму', () => {
    const stars = [
      star({ id: 1, x: 100, y: 100, visible: false }),
      star({ id: 2, x: 112, y: 100, visible: true }),
    ];
    expect(pickStar(stars, { x: 100, y: 100 })).toBe(2);
  });

  it('порядок у масиві нічого не вирішує', () => {
    const a = star({ id: 1, x: 100, y: 100 });
    const b = star({ id: 2, x: 130, y: 100 });
    expect(pickStar([a, b], { x: 104, y: 100 })).toBe(pickStar([b, a], { x: 104, y: 100 }));
  });

  it('рівна відстань розв’язується стабільно, а не порядком', () => {
    const a = star({ id: 7, x: 90, y: 100 });
    const b = star({ id: 3, x: 110, y: 100 });
    expect(pickStar([a, b], { x: 100, y: 100 })).toBe(3);
    expect(pickStar([b, a], { x: 100, y: 100 })).toBe(3);
  });

  it('вибір по вертикалі працює так само, як по горизонталі', () => {
    const stars = [star({ id: 5, x: 100, y: 200, radius: 6 })];
    expect(pickStar(stars, { x: 100, y: 200 + TOUCH_TARGET - 1 })).toBe(5);
    expect(pickStar(stars, { x: 100, y: 200 + TOUCH_TARGET + 5 })).toBeNull();
  });

  it('по діагоналі межа кругла, а не квадратна', () => {
    const stars = [star({ id: 5, x: 0, y: 0, radius: 6 })];
    // Кут квадрата TOUCH_TARGET×TOUCH_TARGET лежить далі за радіус.
    const corner = TOUCH_TARGET * 0.75;
    expect(pickStar(stars, { x: corner, y: corner })).toBeNull();
    expect(pickStar(stars, { x: TOUCH_TARGET * 0.7, y: 0 })).toBe(5);
  });
});
