import { describe, expect, it } from 'vitest';
import {
  buildConstellation,
  CONSTELLATION_HEIGHT,
  CONSTELLATION_WIDTH,
  type ConstellationInput,
} from './constellationLayout';

const event = (id: number, date: string, milestone = false): ConstellationInput =>
  ({ id, date, milestone });

/** Сім подій цієї пари — той самий набір, на якому мірявся живий екран. */
const COUPLE: ConstellationInput[] = [
  event(1, '2022-05-22'),
  event(2, '2022-10-04'),
  event(3, '2022-12-26', true),
  event(4, '2023-07-08'),
  event(5, '2026-07-13'),
  event(6, '2026-07-25'),
  event(7, '2026-08-06'),
];

describe('buildConstellation', () => {
  it('порожня історія дає порожнє небо', () => {
    expect(buildConstellation([])).toEqual({
      stars: [],
      edges: [],
      width: CONSTELLATION_WIDTH,
      height: CONSTELLATION_HEIGHT,
    });
  });

  it('одна подія — одна зірка, без декоративних вузлів', () => {
    expect(buildConstellation(COUPLE).stars).toHaveLength(COUPLE.length);
  });

  it('та сама історія дає ту саму карту', () => {
    expect(buildConstellation(COUPLE)).toEqual(buildConstellation([...COUPLE].reverse()));
  });

  it('ядро — найраніша ключова подія, і воно в центрі кадру', () => {
    const { stars } = buildConstellation(COUPLE);
    const core = stars.filter((star) => star.core);
    expect(core).toHaveLength(1);
    expect(core[0]!.id).toBe(3);
    expect(core[0]).toMatchObject({ x: CONSTELLATION_WIDTH / 2, y: CONSTELLATION_HEIGHT / 2 });
  });

  it('без ключових подій ядра немає', () => {
    const { stars } = buildConstellation([event(1, '2024-01-01'), event(2, '2024-02-01')]);
    expect(stars.some((star) => star.core)).toBe(false);
  });

  it('ядром стає найраніша ключова, а не найперша подія', () => {
    const stars = buildConstellation([
      event(1, '2022-05-22'),
      event(2, '2022-12-26', true),
      event(3, '2023-01-01', true),
    ]).stars;
    expect(stars.find((star) => star.core)!.id).toBe(2);
  });
});

describe('промені', () => {
  it('n зірок дають рівно n−1 променів', () => {
    const { stars, edges } = buildConstellation(COUPLE);
    expect(edges).toHaveLength(stars.length - 1);
  });

  it('жодна зірка не стає хабом: не більше двох променів на зірку', () => {
    const { edges } = buildConstellation(COUPLE);
    const degree = new Map<number, number>();
    for (const edge of edges) {
      degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
      degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    }
    expect(Math.max(...degree.values())).toBeLessThanOrEqual(2);
  });

  it('ланцюг іде за датою, а не за порядком створення', () => {
    const { edges } = buildConstellation([
      event(10, '2024-03-01'),
      event(11, '2024-01-01'),
      event(12, '2024-02-01'),
    ]);
    expect(edges.map((edge) => [edge.fromId, edge.toId])).toEqual([[11, 12], [12, 10]]);
  });

  it('промені не роблять петлю: кінці ланцюга мають по одному', () => {
    const { edges } = buildConstellation(COUPLE);
    const degree = new Map<number, number>();
    for (const edge of edges) {
      degree.set(edge.fromId, (degree.get(edge.fromId) ?? 0) + 1);
      degree.set(edge.toId, (degree.get(edge.toId) ?? 0) + 1);
    }
    const ends = [...degree.values()].filter((value) => value === 1);
    expect(ends).toHaveLength(2);
  });

  it('навіть на тридцяти подіях це лишається ланцюгом, а не павутиною', () => {
    const many = Array.from({ length: 30 }, (_value, index) =>
      event(index + 1, `2024-${String((index % 12) + 1).padStart(2, '0')}-15`));
    const { stars, edges } = buildConstellation(many);
    expect(edges).toHaveLength(stars.length - 1);
  });
});

describe('стабільність карти', () => {
  it('нова подія не зсуває жодну зі старих зірок', () => {
    const before = buildConstellation(COUPLE);
    const after = buildConstellation([...COUPLE, event(8, '2026-09-01')]);
    for (const star of before.stars) {
      const moved = after.stars.find((candidate) => candidate.id === star.id)!;
      expect({ x: moved.x, y: moved.y }).toEqual({ x: star.x, y: star.y });
    }
  });

  it('подія, додана заднім числом, теж нікого не зсуває', () => {
    const before = buildConstellation(COUPLE);
    const after = buildConstellation([...COUPLE, event(9, '2021-01-01')]);
    for (const star of before.stars) {
      const moved = after.stars.find((candidate) => candidate.id === star.id)!;
      expect({ x: moved.x, y: moved.y }).toEqual({ x: star.x, y: star.y });
    }
  });

  it('але ланцюг приймає її на своє хронологічне місце', () => {
    const { edges } = buildConstellation([...COUPLE, event(9, '2021-01-01')]);
    expect(edges[0]!.fromId).toBe(9);
  });
});

describe('геометрія', () => {
  it('зірки не накладаються одна на одну', () => {
    const { stars } = buildConstellation(COUPLE);
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const a = stars[i]!;
        const b = stars[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radius + b.radius);
      }
    }
  });

  it('жодна зірка не виходить за кадр', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThanOrEqual(CONSTELLATION_WIDTH);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThanOrEqual(CONSTELLATION_HEIGHT);
    }
  });

  it('ключові зірки більші за звичайні, а ядро — найбільше', () => {
    const { stars } = buildConstellation(COUPLE);
    const core = stars.find((star) => star.core)!;
    const regular = stars.find((star) => star.level === 'regular')!;
    expect(core.radius).toBeGreaterThan(regular.radius);
  });

  it('координати завжди скінченні', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.y)).toBe(true);
    }
  });

  it('не чіпає вхідний масив', () => {
    const source = [...COUPLE];
    buildConstellation(source);
    expect(source).toEqual(COUPLE);
  });
});
