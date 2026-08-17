import { describe, expect, it } from 'vitest';
import {
  buildConstellation3D,
  CORE_STAR_RADIUS,
  timeAxis,
  type Star3D,
} from './constellation3d';
import type { ConstellationEvent } from './constellationRules';

/** Справжній набір пари: сім подій, два ключові види, різні рівні. */
const COUPLE: ConstellationEvent[] = [
  { id: 1, date: '2022-12-26', significance: 'relationship_start' },
  { id: 2, date: '2023-03-08', significance: 'important' },
  { id: 3, date: '2023-08-12', significance: 'regular' },
  { id: 4, date: '2024-02-14', significance: 'important' },
  { id: 5, date: '2024-07-01', significance: 'regular' },
  { id: 6, date: '2025-05-19', significance: 'regular' },
  { id: 7, date: '2025-09-30', significance: 'important' },
];

function positions(stars: readonly Star3D[]): Map<number, string> {
  return new Map(stars.map((star) => [
    star.id,
    `${star.x.toFixed(6)},${star.y.toFixed(6)},${star.z.toFixed(6)}`,
  ]));
}

function starById(stars: readonly Star3D[], id: number): Star3D {
  const star = stars.find((candidate) => candidate.id === id);
  if (!star) throw new Error(`зірки ${id} немає`);
  return star;
}

describe('вісь часу', () => {
  it('строго зростає — порядок подій не можна загубити стисненням', () => {
    let previous = Number.NEGATIVE_INFINITY;
    for (let days = -12_000; days <= 12_000; days += 37) {
      const value = timeAxis(days);
      expect(value).toBeGreaterThan(previous);
      previous = value;
    }
  });

  it('перші вісім років ідуть один до одного', () => {
    // 12 одиниць на рік без спотворення: пара з типовим стажем бачить рівну
    // шкалу, а не логарифм.
    expect(timeAxis(365.2425)).toBeCloseTo(12, 6);
    expect(timeAxis(365.2425 * 8)).toBeCloseTo(96, 6);
  });

  it('за вісьмома роками стискає, а не обриває', () => {
    const twenty = timeAxis(365.2425 * 20);
    // Лінійна шкала дала б 240 одиниць; стиснення забирає понад чверть…
    expect(twenty).toBeLessThan(240 * 0.75);
    // …але порядок лишається: двадцять років далі за вісім, і помітно далі.
    expect(twenty).toBeGreaterThan(timeAxis(365.2425 * 8) * 1.5);
  });

  it('симетрична: подія до ядра відліку дзеркальна події після', () => {
    expect(timeAxis(-900)).toBeCloseTo(-timeAxis(900), 9);
    expect(timeAxis(0)).toBe(0);
  });
});

describe('buildConstellation3D', () => {
  it('порожній набір дає порожнє небо, а не виняток', () => {
    expect(buildConstellation3D([])).toEqual({
      stars: [],
      edges: [],
      reach: 0,
      centre: { x: 0, y: 0, z: 0 },
      axial: 0,
      radial: 0,
      span: 0,
    });
  });

  it('той самий набір дає те саме сузір’я', () => {
    expect(buildConstellation3D(COUPLE)).toEqual(buildConstellation3D(COUPLE));
  });

  it('порядок у вхідному масиві нічого не важить', () => {
    const shuffled = [COUPLE[4], COUPLE[0], COUPLE[6], COUPLE[2], COUPLE[1], COUPLE[5], COUPLE[3]]
      .filter((event): event is ConstellationEvent => event !== undefined);
    expect(buildConstellation3D(shuffled)).toEqual(buildConstellation3D(COUPLE));
  });

  it('усі координати скінченні', () => {
    const { stars, reach, span } = buildConstellation3D(COUPLE);
    for (const star of stars) {
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.y)).toBe(true);
      expect(Number.isFinite(star.z)).toBe(true);
      expect(star.radius).toBeGreaterThan(0);
    }
    expect(Number.isFinite(reach)).toBe(true);
    expect(Number.isFinite(span)).toBe(true);
  });

  it('одна подія — одна зірка, і жодного зайвого вузла', () => {
    const { stars } = buildConstellation3D(COUPLE);
    expect(stars).toHaveLength(COUPLE.length);
    expect(new Set(stars.map((star) => star.id)).size).toBe(COUPLE.length);
  });
});

describe('ядро', () => {
  it('поки одруження немає — центр належить початку відносин', () => {
    const { stars } = buildConstellation3D(COUPLE);
    const core = stars.filter((star) => star.core);
    expect(core).toHaveLength(1);
    expect(core[0]!.id).toBe(1);
    expect(core[0]!.radius).toBe(CORE_STAR_RADIUS);
  });

  it('стоїть рівно в нулі', () => {
    const core = starById(buildConstellation3D(COUPLE).stars, 1);
    expect(core.x).toBe(0);
    expect(core.y).toBe(0);
    expect(core.z).toBe(0);
  });

  it('одруження забирає центр, а початок відносин лишається ключовим', () => {
    const married = [...COUPLE, { id: 8, date: '2026-06-06', significance: 'marriage' as const }];
    const { stars } = buildConstellation3D(married);
    expect(starById(stars, 8).core).toBe(true);
    expect(starById(stars, 1).core).toBe(false);
    expect(starById(stars, 1).level).toBe('key');
  });

  it('нуль лишається вільним: ядро сідає туди, нікого не зачепивши', () => {
    const { stars } = buildConstellation3D(COUPLE);
    const core = starById(stars, 1);
    for (const star of stars) {
      if (star.core) continue;
      const distance = Math.hypot(star.x, star.y, star.z);
      expect(distance).toBeGreaterThan(core.radius + star.radius);
    }
  });

  it('порожнє від ключових подій небо взагалі не має ядра', () => {
    const plain: ConstellationEvent[] = [
      { id: 1, date: '2023-01-01', significance: 'regular' },
      { id: 2, date: '2023-06-01', significance: 'important' },
    ];
    const { stars } = buildConstellation3D(plain);
    expect(stars.every((star) => !star.core)).toBe(true);
  });
});

describe('стара зірка не рухається', () => {
  it('нова подія в кінці нікого не зрушує', () => {
    const before = positions(buildConstellation3D(COUPLE).stars);
    const after = positions(buildConstellation3D([
      ...COUPLE,
      { id: 8, date: '2026-01-11', significance: 'regular' },
    ]).stars);
    for (const [id, place] of before) expect(after.get(id)).toBe(place);
  });

  it('подія, додана заднім числом, теж нікого не зрушує', () => {
    // Найгірший випадок: дата раніша за все, що вже є, тобто ланцюг
    // перебудовується, а розміщення — ні.
    const before = positions(buildConstellation3D(COUPLE).stars);
    const after = positions(buildConstellation3D([
      ...COUPLE,
      { id: 8, date: '2022-12-01', significance: 'important' },
    ]).stars);
    for (const [id, place] of before) expect(after.get(id)).toBe(place);
  });

  it('одруження рухає РІВНО двох: колишнє ядро й себе', () => {
    // Це і є обіцянка модуля. Якби вісь часу відлічувалась від ядра, тут
    // зсунулись би всі сім.
    const before = positions(buildConstellation3D(COUPLE).stars);
    const after = positions(buildConstellation3D([
      ...COUPLE,
      { id: 8, date: '2026-06-06', significance: 'marriage' },
    ]).stars);
    const moved = [...before].filter(([id, place]) => after.get(id) !== place);
    expect(moved.map(([id]) => id)).toEqual([1]);
  });

  it('колишнє ядро повертається на своє й ніким не зайняте місце', () => {
    const married = [...COUPLE, { id: 8, date: '2026-06-06', significance: 'marriage' as const }];
    const { stars } = buildConstellation3D(married);
    const start = starById(stars, 1);
    expect(Math.hypot(start.x, start.y, start.z)).toBeGreaterThan(0);
    for (const star of stars) {
      if (star.id === 1) continue;
      const distance = Math.hypot(star.x - start.x, star.y - start.y, star.z - start.z);
      expect(distance).toBeGreaterThan(star.radius + start.radius);
    }
  });
});

describe('промені', () => {
  it('рівно n−1 променів на n зірок', () => {
    const { edges } = buildConstellation3D(COUPLE);
    expect(edges).toHaveLength(COUPLE.length - 1);
  });

  it('кожен промінь веде до попередньої за датою події', () => {
    const { edges } = buildConstellation3D(COUPLE);
    expect(edges.map((edge) => [edge.fromId, edge.toId])).toEqual([
      [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7],
    ]);
  });

  it('жодна зірка не стає хабом: не більше двох променів на зірку', () => {
    const { edges } = buildConstellation3D(COUPLE);
    const degree = new Map<number, number>();
    for (const edge of edges) {
      degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
      degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    }
    for (const count of degree.values()) expect(count).toBeLessThanOrEqual(2);
  });

  it('кінці променя збігаються з позиціями зірок', () => {
    const { stars, edges } = buildConstellation3D(COUPLE);
    for (const edge of edges) {
      const from = starById(stars, edge.fromId);
      const to = starById(stars, edge.toId);
      expect(edge.from).toEqual({ x: from.x, y: from.y, z: from.z });
      expect(edge.to).toEqual({ x: to.x, y: to.y, z: to.z });
    }
  });

  it('одна подія — жодного променя', () => {
    const { edges, span } = buildConstellation3D([COUPLE[0]!]);
    expect(edges).toHaveLength(0);
    expect(span).toBe(0);
  });
});

describe('простір між зірками', () => {
  it('жодні дві зірки не злипаються', () => {
    const { stars } = buildConstellation3D(COUPLE);
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const a = stars[i]!;
        const b = stars[j]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        expect(distance).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it('тримається навіть коли тридцять подій сідають на один тиждень', () => {
    // Найгірший випадок для осі часу: вона не розводить нікого, і вся робота
    // лягає на кут та радіус.
    const crowd: ConstellationEvent[] = Array.from({ length: 30 }, (_value, index) => ({
      id: index + 1,
      date: `2024-03-${String((index % 7) + 1).padStart(2, '0')}`,
      significance: index % 3 === 0 ? 'important' : 'regular',
    }));
    const { stars } = buildConstellation3D(crowd);
    let touching = 0;
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const a = stars[i]!;
        const b = stars[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= a.radius + b.radius) touching += 1;
      }
    }
    expect(touching).toBe(0);
  });
});

describe('рівень задає відстань від осі часу', () => {
  it('ключові йдуть кістяком, звичайні — зовнішнім кільцем', () => {
    const many: ConstellationEvent[] = [
      { id: 1, date: '2022-12-26', significance: 'relationship_start' },
      { id: 2, date: '2023-05-05', significance: 'marriage' },
      { id: 3, date: '2023-06-06', significance: 'important' },
      { id: 4, date: '2023-07-07', significance: 'regular' },
    ];
    const { stars } = buildConstellation3D(many);
    // Ядро в нулі, тож міряємо ту зірку, що лишилась ключовою.
    const axisDistance = (star: Star3D) => Math.hypot(star.x, star.y);
    expect(axisDistance(starById(stars, 1))).toBeLessThan(axisDistance(starById(stars, 3)));
    expect(axisDistance(starById(stars, 3))).toBeLessThan(axisDistance(starById(stars, 4)));
  });

  it('ядро найбільше з усіх', () => {
    const { stars } = buildConstellation3D(COUPLE);
    const core = starById(stars, 1);
    for (const star of stars) {
      if (star.core) continue;
      expect(star.radius).toBeLessThan(core.radius);
    }
  });
});

describe('черга появи', () => {
  it('порядок іде за хронологією, а не за створенням', () => {
    const backdated = [
      ...COUPLE,
      { id: 8, date: '2023-01-01', significance: 'regular' as const },
    ];
    const { stars } = buildConstellation3D(backdated);
    expect(starById(stars, 8).order).toBe(1);
    expect(starById(stars, 1).order).toBe(0);
    expect([...stars].sort((a, b) => a.order - b.order).map((star) => star.id))
      .toEqual([1, 8, 2, 3, 4, 5, 6, 7]);
  });
});

describe('кадрування', () => {
  it('reach накриває найдальшу зірку разом із її тілом', () => {
    const { stars, reach } = buildConstellation3D(COUPLE);
    for (const star of stars) {
      expect(Math.hypot(star.x, star.y, star.z) + star.radius).toBeLessThanOrEqual(reach + 1e-9);
    }
  });

  it('radial накриває найдальший відступ від осі часу', () => {
    // Це число вирішує, наскільки далеко камері відходити на ВУЗЬКОМУ екрані,
    // і саме його бракувало, коли з восьми зірок у кадр потрапило шість.
    const { stars, radial, reach } = buildConstellation3D(COUPLE);
    for (const star of stars) {
      expect(Math.hypot(star.x, star.y) + star.radius).toBeLessThanOrEqual(radial + 1e-9);
    }
    expect(radial).toBeLessThanOrEqual(reach + 1e-9);
    expect(radial).toBeGreaterThan(0);
  });

  it('середина накриває сузір’я, а не збігається з ядром', () => {
    /*
     * Регрес, знайдений на живому екрані.
     *
     * Ядро стоїть у НУЛІ осі часу, тобто на самому початку шляху, а всі інші
     * події лежать по один бік від нього. Камера, наведена на нуль, показувала
     * нижню третину кадру порожньою, а дальню зірку лишала за верхнім краєм.
     * Тому камера дивиться на середину габариту, а не на ядро.
     */
    const { stars, centre, axial, radial } = buildConstellation3D(COUPLE);
    for (const star of stars) {
      expect(Math.abs(star.z - centre.z) + star.radius).toBeLessThanOrEqual(axial + 1e-9);
      expect(Math.hypot(star.x - centre.x, star.y - centre.y) + star.radius)
        .toBeLessThanOrEqual(radial + 1e-9);
    }
    // Усі події цієї пари пізніші за ядро, тож середина мусить бути помітно
    // далі по осі часу, ніж нуль.
    expect(centre.z).toBeGreaterThan(axial * 0.5);
  });

  it('span дорівнює протяжності по осі часу', () => {
    const { stars, span } = buildConstellation3D(COUPLE);
    const zs = stars.map((star) => star.z);
    expect(span).toBeCloseTo(Math.max(...zs) - Math.min(...zs), 9);
    expect(span).toBeGreaterThan(0);
  });
});
