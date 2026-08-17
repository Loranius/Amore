import { describe, expect, it } from 'vitest';
import { focusDistance, journeyFraming, type JourneyShape, type JourneyViewport } from './journeyFraming';

/** Телефон пари: 412×915. */
const PHONE: JourneyViewport = { aspect: 412 / 915, fovY: 52 };
/** Широкий екран. */
const WIDE: JourneyViewport = { aspect: 1280 / 800, fovY: 52 };

/** Справжні числа сузір'я цієї пари: вісім подій за три з половиною роки. */
const COUPLE: JourneyShape = { radial: 16.7, axial: 26.1 };

type Vec = readonly [number, number, number];

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function unit(v: Vec): Vec {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/**
 * Наскільки далеко за край кадру виїжджає найгірша точка габариту.
 *
 * Незалежна перевірка: тест НЕ повторює формулу кадрування, а бере камеру з
 * її результату й проєктує кути сам. Один — рівно край, більше — за кадром.
 *
 * Саме цього бракувало обом виміряним вадам: перша редакція не питала про
 * форму екрана, друга міряла сузір'я як плоску мішень і не бачила, що ближня
 * до камери зірка займає в кадрі більше за дальню.
 */
function worstOverflow(shape: JourneyShape, viewport: JourneyViewport): number {
  const framing = journeyFraming(shape, viewport);
  const tanY = Math.tan((viewport.fovY * Math.PI) / 360);
  const tanX = tanY * viewport.aspect;
  const direction = framing.direction as Vec;
  const forward: Vec = [-direction[0], -direction[1], -direction[2]];
  const right = unit(cross(forward, framing.up as Vec));
  const trueUp = cross(right, forward);
  const eye: Vec = [
    direction[0] * framing.distance,
    direction[1] * framing.distance,
    direction[2] * framing.distance,
  ];

  let worst = 0;
  for (const x of [-shape.radial, shape.radial]) {
    for (const y of [-shape.radial, shape.radial]) {
      for (const z of [-shape.axial, shape.axial]) {
        const v: Vec = [x - eye[0], y - eye[1], z - eye[2]];
        const depth = dot(v, forward);
        if (depth <= 0) return Number.POSITIVE_INFINITY;
        worst = Math.max(
          worst,
          Math.abs(dot(v, right)) / (depth * tanX),
          Math.abs(dot(v, trueUp)) / (depth * tanY),
        );
      }
    }
  }
  return worst;
}

describe('journeyFraming', () => {
  it('на телефоні сузір’я цієї пари вміщається цілком', () => {
    expect(worstOverflow(COUPLE, PHONE)).toBeLessThanOrEqual(1);
  });

  it('на широкому екрані теж', () => {
    // Регрес: тут виїхали два краї, бо перспективу ближнього боку не рахували.
    expect(worstOverflow(COUPLE, WIDE)).toBeLessThanOrEqual(1);
  });

  it('вміщається на будь-якій формі сузір’я та екрана', () => {
    const shapes: JourneyShape[] = [
      { radial: 16.7, axial: 26.1 }, // ця пара
      { radial: 8.5, axial: 0 }, // одна подія
      { radial: 16, axial: 2 }, // десяток подій за місяць
      { radial: 17, axial: 160 }, // двадцять років разом
      { radial: 3, axial: 40 }, // самі ключові події
    ];
    const screens: JourneyViewport[] = [
      PHONE,
      WIDE,
      { aspect: 834 / 1112, fovY: 52 }, // планшет
      { aspect: 0.32, fovY: 52 }, // дуже вузьке вікно
    ];
    for (const shape of shapes) {
      for (const screen of screens) {
        expect(worstOverflow(shape, screen)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('кадр не марнується: сузір’я займає більшу частину його', () => {
    // Вміститись легко, відлетівши на кілометр. Запас має лишатись запасом.
    expect(worstOverflow(COUPLE, PHONE)).toBeGreaterThan(0.75);
    expect(worstOverflow(COUPLE, WIDE)).toBeGreaterThan(0.75);
  });

  it('вісь часу лягає на ДОВШУ сторону кадру', () => {
    expect(journeyFraming(COUPLE, PHONE).up).toEqual([0, 0, 1]);
    expect(journeyFraming(COUPLE, WIDE).up).toEqual([0, 1, 0]);
  });

  it('коротке й товсте сузір’я повертається навпаки', () => {
    const stubby: JourneyShape = { radial: 16, axial: 2 };
    expect(journeyFraming(stubby, PHONE).up).toEqual([0, 1, 0]);
  });

  it('вузький екран відсуває камеру далі за широкий', () => {
    // Це і є причина першої вади: горизонтальне поле зору на портреті вужче.
    expect(journeyFraming(COUPLE, PHONE).distance)
      .toBeGreaterThan(journeyFraming(COUPLE, WIDE).distance);
  });

  it('порожнє сузір’я не дає нуля, нескінченності чи NaN', () => {
    const framing = journeyFraming({ radial: 0, axial: 0 }, PHONE);
    for (const value of [
      framing.distance,
      framing.introDistance,
      framing.minDistance,
      framing.maxDistance,
    ]) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('політ починається далі, ніж закінчується, і не виходить за межі орбіти', () => {
    const framing = journeyFraming(COUPLE, PHONE);
    expect(framing.introDistance).toBeGreaterThan(framing.distance);
    expect(framing.introDistance).toBeLessThanOrEqual(framing.maxDistance);
    expect(framing.minDistance).toBeLessThan(framing.distance);
  });

  it('напрямок на камеру одиничний і не вздовж осі часу', () => {
    const [x, y, z] = journeyFraming(COUPLE, PHONE).direction;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    // Дивитись уздовж осі часу означало б побачити сузір'я з торця.
    expect(Math.abs(z)).toBeLessThan(0.01);
  });

  it('вироджена ширина кадру не ділить на нуль', () => {
    expect(Number.isFinite(journeyFraming(COUPLE, { aspect: 0, fovY: 52 }).distance)).toBe(true);
  });

  it('те саме сузір’я на тому самому екрані кадрується однаково', () => {
    expect(journeyFraming(COUPLE, PHONE)).toEqual(journeyFraming(COUPLE, PHONE));
  });
});

describe('focusDistance', () => {
  const RADIUS = 3.4;

  it('сонце вміщається у ВУЖЧУ сторону кадру', () => {
    for (const viewport of [PHONE, WIDE, { aspect: 0.4, fovY: 52 }]) {
      const distance = focusDistance(RADIUS, viewport);
      const tanY = Math.tan((viewport.fovY * Math.PI) / 360);
      const tanX = tanY * viewport.aspect;
      expect(RADIUS).toBeLessThanOrEqual(distance * Math.min(tanY, tanX));
    }
  });

  it('вузький екран відсуває камеру далі за широкий', () => {
    expect(focusDistance(RADIUS, PHONE)).toBeGreaterThan(focusDistance(RADIUS, WIDE));
  });

  it('більша подія відсуває камеру далі', () => {
    expect(focusDistance(6, PHONE)).toBeGreaterThan(focusDistance(3, PHONE));
  });

  it('камера ніколи не опиняється всередині сонця', () => {
    for (const radius of [0.5, 3.4, 12]) {
      for (const viewport of [PHONE, WIDE, { aspect: 4, fovY: 52 }]) {
        expect(focusDistance(radius, viewport)).toBeGreaterThan(radius);
      }
    }
  });

  it('вироджений кадр не дає нескінченності', () => {
    expect(Number.isFinite(focusDistance(RADIUS, { aspect: 0, fovY: 52 }))).toBe(true);
  });
});
