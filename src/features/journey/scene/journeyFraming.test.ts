import { describe, expect, it } from 'vitest';
import { buildConstellation3D } from '../constellation3d';
import type { ConstellationEvent } from '../constellationRules';
import {
  focusDistance,
  journeyFraming,
  type JourneyBody,
  type JourneyViewport,
} from './journeyFraming';

/** Телефон пари: 412×915. */
const PHONE: JourneyViewport = { aspect: 412 / 915, fovY: 52 };
/** Широкий екран. */
const WIDE: JourneyViewport = { aspect: 1280 / 800, fovY: 52 };

/**
 * Габаритна коробка як вісім точкових тіл.
 *
 * Саме так кадрування працювало до третьої редакції, і всі випадки, знайдені
 * знімком, описані в цих термінах. Коробка лишається в тесті навмисно: вона
 * найгірший можливий набір тіл, і вимога «вміщається цілком» на ній мусить
 * триматись так само, як на справжніх зірках.
 */
function boxBodies(radial: number, axial: number): JourneyBody[] {
  const out: JourneyBody[] = [];
  for (const x of [-radial, radial]) {
    for (const y of [-radial, radial]) {
      for (const z of [-axial, axial]) out.push({ x, y, z, radius: 0 });
    }
  }
  return out;
}

/** Справжні числа сузір'я цієї пари: вісім подій за три з половиною роки. */
const COUPLE_BOX = boxBodies(16.7, 26.1);

/** І воно ж — справжніми зірками, а не коробкою. */
const COUPLE: ConstellationEvent[] = [
  { id: 1, date: '2022-12-26', significance: 'relationship_start' },
  { id: 2, date: '2023-03-08', significance: 'important' },
  { id: 3, date: '2023-08-12', significance: 'regular' },
  { id: 4, date: '2024-02-14', significance: 'important' },
  { id: 5, date: '2024-07-01', significance: 'regular' },
  { id: 6, date: '2025-05-19', significance: 'regular' },
  { id: 7, date: '2025-09-30', significance: 'important' },
  { id: 8, date: '2026-06-06', significance: 'marriage' },
];

function coupleBodies(): JourneyBody[] {
  const { stars, centre } = buildConstellation3D(COUPLE);
  return stars.map((star) => ({
    x: star.x - centre.x,
    y: star.y - centre.y,
    z: star.z - centre.z,
    radius: star.radius,
  }));
}

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
 * Наскільки далеко за край кадру виїжджає найгірше тіло.
 *
 * Незалежна перевірка: тест НЕ повторює формулу кадрування, а бере камеру з
 * її результату й проєктує тіла сам. Один — рівно край, більше — за кадром,
 * менше — марно витрачений кадр.
 *
 * Саме цього бракувало всім трьом виміряним вадам: перша редакція не питала
 * про форму екрана, друга міряла сузір'я як плоску мішень і не бачила, що
 * ближня до камери зірка займає в кадрі більше за дальню, третя вміщала
 * коробку, у кутах якої зірок немає.
 */
function worstOverflow(bodies: readonly JourneyBody[], viewport: JourneyViewport): number {
  const framing = journeyFraming(bodies, viewport);
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
  for (const body of bodies) {
    const v: Vec = [body.x - eye[0], body.y - eye[1], body.z - eye[2]];
    const depth = dot(v, forward);
    if (depth <= body.radius) return Number.POSITIVE_INFINITY;
    worst = Math.max(
      worst,
      (Math.abs(dot(v, right)) + body.radius * Math.hypot(1, tanX)) / (depth * tanX),
      (Math.abs(dot(v, trueUp)) + body.radius * Math.hypot(1, tanY)) / (depth * tanY),
    );
  }
  return worst;
}

describe('journeyFraming', () => {
  it('на телефоні сузір’я цієї пари вміщається цілком', () => {
    expect(worstOverflow(COUPLE_BOX, PHONE)).toBeLessThanOrEqual(1);
    expect(worstOverflow(coupleBodies(), PHONE)).toBeLessThanOrEqual(1);
  });

  it('на широкому екрані теж', () => {
    // Регрес: тут виїхали два краї, бо перспективу ближнього боку не рахували.
    expect(worstOverflow(COUPLE_BOX, WIDE)).toBeLessThanOrEqual(1);
    expect(worstOverflow(coupleBodies(), WIDE)).toBeLessThanOrEqual(1);
  });

  it('тіло з радіусом вміщається РАЗОМ зі своїм радіусом', () => {
    // Зірка радіуса 1.6, чий центр рівно на межі кадру, показала б парі
    // половину себе. Габарит рахується по краях тіл, не по центрах.
    const fat: JourneyBody[] = [
      { x: 0, y: 0, z: -20, radius: 2.8 },
      { x: 14, y: 3, z: 20, radius: 2 },
    ];
    for (const screen of [PHONE, WIDE]) expect(worstOverflow(fat, screen)).toBeLessThanOrEqual(1);
  });

  it('вміщається на будь-якій формі сузір’я та екрана', () => {
    const clouds: JourneyBody[][] = [
      COUPLE_BOX,
      coupleBodies(),
      boxBodies(8.5, 0), // одна подія
      boxBodies(16, 2), // десяток подій за місяць
      boxBodies(17, 160), // двадцять років разом
      boxBodies(3, 40), // самі ключові події
    ];
    const screens: JourneyViewport[] = [
      PHONE,
      WIDE,
      { aspect: 834 / 1112, fovY: 52 }, // планшет
      { aspect: 0.32, fovY: 52 }, // дуже вузьке вікно
    ];
    for (const cloud of clouds) {
      for (const screen of screens) {
        expect(worstOverflow(cloud, screen)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('кадр не марнується: сузір’я впирається в його край', () => {
    /*
     * Головна вимога власника до цього етапу — «простір домінує над сузір'ям».
     *
     * Вміститись легко, відлетівши на кілометр. Запас має лишатись запасом, і
     * саме це число його стереже: 0.97 означає, що крайня зірка стоїть за три
     * відсотки півсторони від рамки.
     *
     * Виміряно, чому цього не давала коробка: на широкому екрані під коробку
     * шлях займав 58% ширини кадру. Тепер тест міряє САМІ зірки, і жодне
     * симетричне наближення тут не пройде.
     */
    for (const screen of [PHONE, WIDE]) {
      expect(worstOverflow(coupleBodies(), screen)).toBeGreaterThan(0.9);
    }
  });

  it('вісь часу лягає на ДОВШУ сторону кадру', () => {
    expect(journeyFraming(COUPLE_BOX, PHONE).up).toEqual([0, 0, 1]);
    expect(journeyFraming(COUPLE_BOX, WIDE).up).toEqual([0, 1, 0]);
  });

  it('коротке й товсте сузір’я повертається навпаки', () => {
    expect(journeyFraming(boxBodies(16, 2), PHONE).up).toEqual([0, 1, 0]);
  });

  it('вузький екран відсуває камеру далі за широкий', () => {
    // Це і є причина першої вади: горизонтальне поле зору на портреті вужче.
    expect(journeyFraming(COUPLE_BOX, PHONE).distance)
      .toBeGreaterThan(journeyFraming(COUPLE_BOX, WIDE).distance);
  });

  it('порожнє сузір’я не дає нуля, нескінченності чи NaN', () => {
    for (const empty of [[], boxBodies(0, 0)]) {
      const framing = journeyFraming(empty, PHONE);
      for (const value of [
        framing.distance,
        framing.introDistance,
        framing.minDistance,
        framing.maxDistance,
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it('політ починається далі, ніж закінчується, і не виходить за межі орбіти', () => {
    const framing = journeyFraming(COUPLE_BOX, PHONE);
    expect(framing.introDistance).toBeGreaterThan(framing.distance);
    expect(framing.introDistance).toBeLessThanOrEqual(framing.maxDistance);
    expect(framing.minDistance).toBeLessThan(framing.distance);
  });

  it('напрямок на камеру одиничний і не вздовж осі часу', () => {
    const [x, y, z] = journeyFraming(COUPLE_BOX, PHONE).direction;
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 9);
    // Дивитись уздовж осі часу означало б побачити сузір'я з торця.
    expect(Math.abs(z)).toBeLessThan(0.01);
  });

  it('вироджена ширина кадру не ділить на нуль', () => {
    expect(Number.isFinite(journeyFraming(COUPLE_BOX, { aspect: 0, fovY: 52 }).distance)).toBe(true);
  });

  it('те саме сузір’я на тому самому екрані кадрується однаково', () => {
    expect(journeyFraming(COUPLE_BOX, PHONE)).toEqual(journeyFraming(COUPLE_BOX, PHONE));
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

  it('навколо розкритої події лишається видимим шматок сузір’я', () => {
    /*
     * Прохання власника: подія розкривається ВСЕРЕДИНІ шляху, а не замість
     * нього. Раніше сонце заповнювало вузьку сторону майже цілком (множник
     * 2.1), і сузір'я зникало з очей. Тепер воно бере близько третини — тобто
     * дві третини вузької сторони лишаються шляху.
     */
    for (const viewport of [PHONE, WIDE]) {
      const distance = focusDistance(RADIUS, viewport);
      const tanY = Math.tan((viewport.fovY * Math.PI) / 360);
      const share = RADIUS / (distance * Math.min(tanY, tanY * viewport.aspect));
      expect(share).toBeLessThan(0.4);
      expect(share).toBeGreaterThan(0.25);
    }
  });

  it('вироджений кадр не дає нескінченності', () => {
    expect(Number.isFinite(focusDistance(RADIUS, { aspect: 0, fovY: 52 }))).toBe(true);
  });
});
