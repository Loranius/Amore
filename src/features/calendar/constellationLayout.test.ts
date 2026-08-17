import { describe, expect, it } from 'vitest';
import {
  buildConstellation,
  CONSTELLATION_HEIGHT,
  CONSTELLATION_WIDTH,
  labelSizeOf,
  segmentsCross,
  type ConstellationInput,
} from './constellationLayout';

/** Скільки пар променів ріжуть одна одну. Використовує той самий предикат,
 *  що й розкладка, — і він окремо перевірений нижче. */
function crossingCount(events: readonly ConstellationInput[]): number {
  const { edges } = buildConstellation(events);
  let crossings = 0;
  for (let i = 0; i < edges.length; i += 1) {
    for (let j = i + 1; j < edges.length; j += 1) {
      const a = edges[i]!;
      const b = edges[j]!;
      const hit = segmentsCross(
        { x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 },
        { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 },
      );
      if (hit) crossings += 1;
    }
  }
  return crossings;
}

const spread = (count: number): ConstellationInput[] =>
  Array.from({ length: count }, (_value, index) => ({
    id: index + 1,
    date: `2024-${String((index % 12) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
    significance: index === 0 ? 'relationship_start' : index % 4 === 0 ? 'important' : 'regular',
    titleLength: 12 + (index % 17),
  }));

const event = (
  id: number,
  date: string,
  significance: ConstellationInput['significance'] = 'regular',
  titleLength = 16,
): ConstellationInput => ({ id, date, significance, titleLength });

/** Сім подій цієї пари — той самий набір, на якому мірявся живий екран. */
const COUPLE: ConstellationInput[] = [
  event(1, '2022-05-22', 'important'),
  event(2, '2022-10-04'),
  event(3, '2022-12-26', 'relationship_start'),
  event(4, '2023-07-08'),
  event(5, '2026-07-13', 'important'),
  event(6, '2026-07-25'),
  event(7, '2026-08-06', 'important'),
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

  it('поки одруження немає, ядро — початок відносин, і воно в центрі кадру', () => {
    const { stars } = buildConstellation(COUPLE);
    const core = stars.filter((star) => star.core);
    expect(core).toHaveLength(1);
    expect(core[0]!.id).toBe(3);
    expect(core[0]).toMatchObject({ x: CONSTELLATION_WIDTH / 2, y: CONSTELLATION_HEIGHT / 2 });
  });

  it('без ключових подій ядра немає', () => {
    const { stars } = buildConstellation([event(1, '2024-01-01'), event(2, '2024-02-01', 'important')]);
    expect(stars.some((star) => star.core)).toBe(false);
  });

  it('«важлива» ядром не стає — ядро тільки з двох ключових видів', () => {
    const { stars } = buildConstellation([
      event(1, '2022-05-22', 'important'),
      event(2, '2022-12-26', 'important'),
    ]);
    expect(stars.some((star) => star.core)).toBe(false);
  });
});

describe('еволюція ядра', () => {
  const WITH_MARRIAGE: ConstellationInput[] = [...COUPLE, event(8, '2027-06-12', 'marriage')];

  it('одруження забирає центр у початку відносин', () => {
    const { stars } = buildConstellation(WITH_MARRIAGE);
    const core = stars.filter((star) => star.core);
    expect(core).toHaveLength(1);
    expect(core[0]!.id).toBe(8);
    expect(core[0]).toMatchObject({ x: CONSTELLATION_WIDTH / 2, y: CONSTELLATION_HEIGHT / 2 });
  });

  it('одруження забирає центр навіть коли воно пізніше за датою', () => {
    const { stars } = buildConstellation([
      event(1, '2020-01-01', 'relationship_start'),
      event(2, '2030-01-01', 'marriage'),
    ]);
    expect(stars.find((star) => star.core)!.id).toBe(2);
  });

  it('початок відносин лишається ключовим, просто вже не в центрі', () => {
    const { stars } = buildConstellation(WITH_MARRIAGE);
    const start = stars.find((star) => star.id === 3)!;
    expect(start.level).toBe('key');
    expect(start.core).toBe(false);
  });

  it('обидві ключові зірки сидять на своїх незмінних місцях', () => {
    const { stars } = buildConstellation(WITH_MARRIAGE);
    const keys = stars.filter((star) => star.level === 'key');
    expect(keys).toHaveLength(2);
    const spots = keys.map((star) => `${star.x},${star.y}`).sort();
    const withoutMarriage = buildConstellation(COUPLE).stars
      .filter((star) => star.level === 'key')
      .map((star) => `${star.x},${star.y}`);
    // Місце, яке звільняє початок відносин, і місце, яке він займає, обидва
    // фіксовані: ядро в центрі, друге ключове — трохи нижче й правіше.
    expect(spots).toContain(withoutMarriage[0]);
  });

  /**
   * Свідомий компроміс, а не недогляд.
   *
   * Обіцянка «рухаються рівно дві зірки» трималась, поки промені не звірялись
   * на перетини. Перевірка дивиться на позиції сусідів по ланцюгу — а коли
   * одруження забирає центр, початок відносин переїжджає, і кожна зірка,
   * поставлена після нього, бачить іншу картину.
   *
   * Вибір був між нулем перетинів щодня і рівно двома зсувами один раз за
   * життя пари. Виміряно: сліпа до ключових перевірка дає 3 перетини на
   * сімох подіях цієї пари, зряча — нуль. Взято нуль.
   */
  it('решта карти при зміні ядра пересідає — і це прийнято', () => {
    const before = buildConstellation(COUPLE);
    const after = buildConstellation(WITH_MARRIAGE);
    const moved = before.stars.filter((star) => {
      const now = after.stars.find((candidate) => candidate.id === star.id)!;
      return now.x !== star.x || now.y !== star.y;
    });
    expect(moved.length).toBeGreaterThan(0);
    // Але сама карта лишається читанною: ланцюг цілий і перетинів мало.
    expect(after.edges).toHaveLength(after.stars.length - 1);
    expect(crossingCount(WITH_MARRIAGE)).toBeLessThanOrEqual(4);
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

  it('три рівні читаються розміром: ядро > ключова > важлива > звичайна', () => {
    const { stars } = buildConstellation([...COUPLE, event(8, '2027-06-12', 'marriage')]);
    const core = stars.find((star) => star.core)!;
    const key = stars.find((star) => star.level === 'key' && !star.core)!;
    const important = stars.find((star) => star.level === 'important')!;
    const regular = stars.find((star) => star.level === 'regular')!;
    expect(core.radius).toBeGreaterThan(key.radius);
    expect(key.radius).toBeGreaterThan(important.radius);
    expect(important.radius).toBeGreaterThan(regular.radius);
  });

  it('важливі зірки тримаються ближче до ядра, ніж звичайні', () => {
    const { stars, width, height } = buildConstellation(COUPLE);
    const reach = (star: (typeof stars)[number]) =>
      Math.hypot(star.x - width / 2, (star.y - height / 2) / 1.34);
    const important = stars.filter((star) => star.level === 'important').map(reach);
    const regular = stars.filter((star) => star.level === 'regular').map(reach);
    expect(Math.max(...important)).toBeLessThan(Math.min(...regular));
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

describe('segmentsCross', () => {
  const p = (x: number, y: number) => ({ x, y });

  it('бачить справжній перетин', () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(0, 10), p(10, 0))).toBe(true);
  });

  it('спільна зірка не є перетином — інакше кожен ланцюг був би винним', () => {
    expect(segmentsCross(p(0, 0), p(10, 10), p(10, 10), p(20, 0))).toBe(false);
  });

  it('відрізки, що не дотикаються, не перетинаються', () => {
    expect(segmentsCross(p(0, 0), p(1, 1), p(5, 5), p(6, 6))).toBe(false);
  });

  it('дотик кінцем усередину чужого відрізка перетином не рахується', () => {
    expect(segmentsCross(p(0, 0), p(10, 0), p(5, 0), p(5, 10))).toBe(false);
  });
});

describe('перетини променів', () => {
  it('на семи подіях цієї пари перетинів немає', () => {
    expect(crossingCount(COUPLE)).toBe(0);
  });

  it('малі карти лишаються чистими', () => {
    expect(crossingCount(spread(5))).toBe(0);
    expect(crossingCount(spread(8))).toBe(0);
  });

  it('на тридцяти подіях перетини лишаються рідкісними', () => {
    // Виміряно: 19. Стеля, а не мета — вона стереже регрес, а не фіксує число.
    // Перед розширенням пошуку тут було 114.
    expect(crossingCount(spread(30))).toBeLessThanOrEqual(30);
  });

  it('ланцюг лишається ланцюгом навіть там, де перетини є', () => {
    const { stars, edges } = buildConstellation(spread(30));
    expect(edges).toHaveLength(stars.length - 1);
  });
});

describe('поводир до назви', () => {
  it('ламана починається осторонь зірки, а не в її центрі', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      const lift = Math.hypot(star.leader.startX - star.x, star.leader.startY - star.y);
      expect(lift).toBeGreaterThan(star.radius);
    }
  });

  it('діагональ переходить у горизонталь: у другому коліні висота стала', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      expect(star.leader.endY).toBe(star.leader.bendY);
      expect(star.leader.endX).not.toBe(star.leader.bendX);
    }
  });

  it('перше коліно справді діагональне — по 45°', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      const runX = Math.abs(star.leader.bendX - star.leader.startX);
      const runY = Math.abs(star.leader.bendY - star.leader.startY);
      expect(runX).toBeCloseTo(runY, 6);
    }
  });

  it('назва лишається в кадрі: горизонталь і текст за нею не виходять за край', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      const { width } = labelSizeOf(star);
      const textEnd = star.leader.align === 'start'
        ? star.leader.endX + width
        : star.leader.endX - width;
      expect(textEnd).toBeGreaterThanOrEqual(-0.001);
      expect(textEnd).toBeLessThanOrEqual(CONSTELLATION_WIDTH + 0.001);
    }
  });

  it('зірка біля правого краю відводить назву ліворуч', () => {
    const { stars } = buildConstellation([
      event(1, '2024-01-01'),
      event(2, '2024-02-01'),
    ]);
    const rightmost = stars.reduce((a, b) => (a.x > b.x ? a : b));
    if (rightmost.x > CONSTELLATION_WIDTH * 0.6) {
      expect(rightmost.leader.endX).toBeLessThan(rightmost.x);
    }
  });

  it('зірка під верхнім краєм відводить назву донизу', () => {
    for (const star of buildConstellation(COUPLE).stars) {
      if (star.y < 12) expect(star.leader.bendY).toBeGreaterThan(star.y);
    }
  });

  it('довша назва дає ширший і вищий блок', () => {
    const short = labelSizeOf({ level: 'regular', core: false, titleLength: 6 });
    const long = labelSizeOf({ level: 'regular', core: false, titleLength: 28 });
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.height).toBeGreaterThan(short.height);
  });

  it('назва не росте нескінченно: перенос має стелю у два рядки', () => {
    const two = labelSizeOf({ level: 'regular', core: false, titleLength: 26 });
    const many = labelSizeOf({ level: 'regular', core: false, titleLength: 200 });
    expect(many.height).toBe(two.height);
  });
});
