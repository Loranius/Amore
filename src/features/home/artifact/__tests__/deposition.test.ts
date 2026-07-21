// ============================================================
// Характеризаційні тести геологічного симулятора (mineralDeposition).
// Фіксують контракти, на яких тримається «еволюція без перебудови»:
//   1. повний детермінізм: (seed, дані) → байт-в-байт той самий артефакт;
//   2. append-only: нові дані сьогоднішньою датою НЕ зрушують жоден
//      існуючий кристал — лише додають нові;
//   3. політика заднього числа: backfill переосаджує ЛИШЕ молодші шари;
//   4. «Evolution Memory»: між днями міняється тільки зрілість/позиція
//      rendered-ланцюга — не ідентичність, не напрямки, не розміри;
//   5. поверхневе прикріплення: кожне тіло нуклеювало на поверхні іншого
//      тіла маси (ніколи з абстрактного трансформу);
//   6. bucketByFixedSize — append-only бакетування.
// ============================================================
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import {
  bucketByFixedSize,
  buildArtifactNodes,
  computeEvolutionPressures,
  depositMineralMass,
  depositMineralMassWithScore,
  distanceToSurface,
  generateArtifactDNA,
  isArtifactEmpty,
  MATURITY_HEIGHT_SCALE,
  MATURITY_RADIUS_SCALE,
  type ArtifactInput,
  type ArtifactNode,
} from '../index';
import { makeNucleus } from '../mineralDeposition';
import { hashSeedString } from '../../mulberry32';

const SEED = '8264-3607-EEA8';
const NOW = new Date('2026-07-21T12:00:00');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function makeInput(overrides: Partial<ArtifactInput> = {}): ArtifactInput {
  const memories = [480, 410, 350, 290, 220, 160, 45].map((age, i) => ({ id: i + 1, date: isoDaysAgo(age) }));
  return {
    seedNum: hashSeedString(SEED),
    dna: generateArtifactDNA(SEED),
    usage: {
      daysTogether: 500,
      photos: 40,
      places: 4,
      moviesWatched: 12,
      booksRead: 2,
      wishesDone: 2,
      goalsAchieved: 1,
      anniversaries: 1,
      recipesSaved: 3,
      distinctCountries: 2,
      milestones: 2,
      totalSaved: 1200,
    },
    countries: [
      { name: 'Italy', firstVisit: isoDaysAgo(400) },
      { name: 'Spain', firstVisit: isoDaysAgo(200) },
    ],
    cities: [
      { name: 'Kyiv', firstVisit: isoDaysAgo(450) },
      { name: 'Rome', firstVisit: isoDaysAgo(398) },
    ],
    milestones: [
      { id: 1, title: 'Заручини', date: isoDaysAgo(300) },
      { id: 2, title: 'Річниця знайомства', date: isoDaysAgo(100) },
    ],
    wishes: [
      { id: 3, fulfilledAt: isoDaysAgo(80) },
      { id: 7, fulfilledAt: isoDaysAgo(20) },
    ],
    achievedGoals: [{ id: 1, date: isoDaysAgo(150) }],
    anniversaries: [{ id: 2, date: isoDaysAgo(135) }],
    recipes: [
      { id: 1, date: isoDaysAgo(90) },
      { id: 2, date: isoDaysAgo(60) },
      { id: 3, date: isoDaysAgo(30) },
    ],
    movies: [
      { id: 1, date: isoDaysAgo(70) },
      { id: 2, date: isoDaysAgo(50) },
    ],
    books: [],
    memoriesCount: memories.length,
    memories,
    ...overrides,
  };
}

function build(input: ArtifactInput): ArtifactNode[] {
  return depositMineralMass(input, computeEvolutionPressures(input));
}

const byKey = (nodes: ArtifactNode[]): Map<string, ArtifactNode> => new Map(nodes.map((n) => [n.key, n]));

/** Ярус ієрархії — єдине поле, якому ДОЗВОЛЕНО дрейфувати при нових даних
 *  (він ранговий і суто візуальний) — тому порівнюємо без нього. */
const stripTier = (n: ArtifactNode): Omit<ArtifactNode, 'tier'> => {
  const { tier: _tier, ...rest } = n;
  return rest;
};

/** Декоративні тіла (композитор може їх «ховати» при нових даних):
 *  супутники/компаньйони/мікрошар (`~`) і амбіентний baseline-трикл. */
const isDecorativeKey = (key: string): boolean => key.includes('~') || key.startsWith('baseline-');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('депозиція мінеральної маси', () => {
  it('повністю детермінована: той самий вхід → байт-в-байт той самий артефакт', () => {
    const a = build(makeInput());
    const b = build(makeInput());
    expect(a.length).toBeGreaterThan(20);
    expect(a).toEqual(b);
  });

  it('порожній вхід → порожня маса (насінина рендериться окремо)', () => {
    const empty = makeInput({
      usage: { ...makeInput().usage, daysTogether: 0 },
      countries: [],
      cities: [],
      milestones: [],
      wishes: [],
      achievedGoals: [],
      anniversaries: [],
      recipes: [],
      movies: [],
      books: [],
      memories: [],
      memoriesCount: 0,
    });
    expect(isArtifactEmpty(empty)).toBe(true);
    expect(build(empty)).toEqual([]);
  });

  it('append-only: нові дані сьогоднішньою датою не зрушують жоден існуючий кристал', () => {
    const base = build(makeInput());
    const grown = build(
      makeInput({
        wishes: [...makeInput().wishes, { id: 99, fulfilledAt: isoDaysAgo(0) }],
        milestones: [...makeInput().milestones, { id: 88, title: 'Переїзд', date: isoDaysAgo(0) }],
      }),
    );
    const grownByKey = byKey(grown);

    for (const node of base) {
      const after = grownByKey.get(node.key);
      if (after === undefined) {
        // Композитор має право «поховати» лише декоративне тіло.
        expect(isDecorativeKey(node.key), `дата-вузол ${node.key} зник`).toBe(true);
        continue;
      }
      // Дрейфувати дозволено лише ярусу ієрархії (ранговий, візуальний).
      expect(stripTier(after), `вузол ${node.key} зрушив`).toEqual(stripTier(node));
    }
    const baseKeys = new Set(base.map((n) => n.key));
    const newKeys = grown.filter((n) => !baseKeys.has(n.key)).map((n) => n.key);
    expect(newKeys).toContain('wish-99');
    expect(newKeys).toContain('milestone-88');
  });

  it('backfill (запис заднім числом) переосаджує лише молодші за себе шари', () => {
    const base = byKey(build(makeInput()));
    const withBackfill = byKey(
      build(makeInput({ countries: [...makeInput().countries, { name: 'Georgia', firstVisit: isoDaysAgo(420) }] })),
    );

    // Старші за backfill (вік > 420 днів) тіла — недоторкані: core-0..2
    // (вік 500/460/420… ні, 420 не строго старше — беремо 500 і 460),
    // city-Kyiv (450). Їхні субстрат, історичне поле й ранги заморожені.
    for (const key of ['core-0', 'core-1', 'city-Kyiv']) {
      expect(stripTier(withBackfill.get(key)!), `${key} зрушив через backfill`).toEqual(stripTier(base.get(key)!));
    }
    expect(withBackfill.has('country-Georgia')).toBe(true);
    // Жоден дата-ключ не зник — backfill не «випаровує» кристали даних
    // (декоративні тіла композитор перерозподіляє — це дозволено).
    for (const key of base.keys()) {
      if (!isDecorativeKey(key)) expect(withBackfill.has(key), `ключ ${key} зник`).toBe(true);
    }
  });

  it('Evolution Memory: наступного місяця та сама ідентичність, лише доросліша', () => {
    const base = build(makeInput());

    // +40 днів: годинник і daysTogether ростуть синхронно (як у житті),
    // дати записів БД незмінні.
    vi.setSystemTime(new Date(NOW.getTime() + 40 * 86_400_000));
    const later = build(makeInput({ usage: { ...makeInput().usage, daysTogether: 540 } }));
    const laterByKey = byKey(later);

    for (const node of base) {
      const grown = laterByKey.get(node.key);
      if (grown === undefined) {
        // Декоративне тіло могло «поховатись» під новим bedrock-ростом.
        expect(isDecorativeKey(node.key), `дата-вузол ${node.key} зник із часом`).toBe(true);
        continue;
      }
      // Ідентичність стабільна; композиція навмисно СТАРІШАЄ тіла разом із
      // віком (товщі/пряміші — Stage 5), тому геометрія еволюціонує плавно,
      // а незалежні від віку поля — незмінні.
      expect(grown.spin).toBe(node.spin);
      expect(grown.breathePhase).toBe(node.breathePhase);
      // Зрілість лише росте (давно насичені тіла лишаються на ~1 —
      // асимптотична крива, тому нестрого).
      expect(grown.maturity).toBeGreaterThanOrEqual(node.maturity);
    }
    // Час народив нове bedrock-відкладення (500/40=13 → 540/40=14).
    expect(laterByKey.has('core-13')).toBe(true);
    // Головний кристал росте рівномірно з днями разом: за 40 днів — вищий.
    const kingBefore = base.find((n) => n.primary)!;
    const kingAfter = laterByKey.get(kingBefore.key)!;
    expect(kingAfter.growthScale).toBeGreaterThan(kingBefore.growthScale);
  });

  it('кожне тіло нуклеювало на поверхні іншого тіла маси', () => {
    const input = makeInput();
    const pressures = computeEvolutionPressures(input);
    const nodes = depositMineralMass(input, pressures);
    const nucleus = makeNucleus(input.seedNum);
    const stabilityFactor = 1 + pressures.stability * 0.15;

    const bodies = [
      { anchor: nucleus.renderedAnchor, direction: nucleus.direction, length: nucleus.length, radius: nucleus.radius },
      ...nodes.map((n) => ({
        anchor: n.anchor,
        direction: n.direction,
        length: n.growthScale * MATURITY_HEIGHT_SCALE(n.maturity),
        radius: (n.massScale / stabilityFactor) * MATURITY_RADIUS_SCALE(n.maturity),
      })),
    ];

    nodes.forEach((node, idx) => {
      // Основа лежить на/під поверхнею ІНШОГО тіла (субстрату) — «жодних
      // плаваючих кристалів». Допуск ширший за конусну апроксимацію, бо
      // композитор міг злегка перекроїти розміри субстрату (архетипи/вік).
      const minDist = Math.min(
        ...bodies.filter((_, b) => b !== idx + 1).map((body) => distanceToSurface(body, node.anchor)),
      );
      expect(minDist, `тіло ${node.key} висить у повітрі`).toBeLessThan(0.12);
    });
  });

  it('колонії та компаньйони тримаються свого батька — жодних самотніх плавунів', () => {
    const nodes = build(makeInput());
    const all = byKey(nodes);
    const satellites = nodes.filter((n) => n.role !== 'dominant');
    expect(satellites.length).toBeGreaterThan(0);
    for (const sat of satellites) {
      // `X~s0` (колонія), `X~t0/~f0` (архетипні компаньйони), `X~m0` (мікро):
      // батько — усе до останнього «~».
      const parentKey = sat.key.slice(0, sat.key.lastIndexOf('~'));
      const parent = all.get(parentKey);
      expect(parent, `тіло ${sat.key} без батька`).toBeDefined();
      if (!parent) continue;
      const dx = sat.anchor.x - parent.anchor.x;
      const dy = sat.anchor.y - parent.anchor.y;
      const dz = sat.anchor.z - parent.anchor.z;
      // Сидить на ТІЛІ батька: відстань від основи батька обмежена його ж
      // габаритами (товстий батько → його поверхня далі від власної основи).
      const hugDistance = 0.45 + parent.massScale;
      expect(Math.sqrt(dx * dx + dy * dy + dz * dz), `${sat.key} відлетів від ${parentKey}`).toBeLessThan(hugDistance);
      expect(sat.growthScale, `${sat.key} не менший за батька`).toBeLessThan(parent.growthScale);
    }
  });

  it('монарх: рівно один primary — найвищий, центральний, майже вертикальний', () => {
    const nodes = build(makeInput());
    const primaries = nodes.filter((n) => n.primary);
    expect(primaries).toHaveLength(1);
    const monarch = primaries[0]!;
    expect(monarch.key).toBe('core-0');
    // Стеля висоти: ніхто не переростає монарха.
    for (const n of nodes) {
      if (n.key === monarch.key) continue;
      expect(n.growthScale, `${n.key} вищий за монарха`).toBeLessThanOrEqual(monarch.growthScale * 0.91);
    }
    // Точно по центру і практично вертикальний — головний кристал друзи
    // (референс: центральна колона, з-під основи якої росте решта).
    expect(Math.hypot(monarch.anchor.x, monarch.anchor.z)).toBeLessThan(0.15);
    expect(monarch.direction.y).toBeGreaterThan(0.95);
    // Дочірні кристали тягнуться вгору: майже всі близькі до вертикалі
    // (виняток — базовий мікропил і рідкісні діагональні тіла).
    const upright = nodes.filter((n) => n.direction.y >= 0.55).length;
    expect(upright / nodes.length).toBeGreaterThan(0.85);
  });

  it('публічний псевдонім buildArtifactNodes — те саме відкладення', () => {
    const input = makeInput();
    const pressures = computeEvolutionPressures(input);
    expect(buildArtifactNodes(input, pressures)).toEqual(depositMineralMass(input, pressures));
  });

  it('композиція: ієрархія ярусів і мікрошар, що «продає» масштаб', () => {
    const nodes = build(makeInput());
    expect(nodes.filter((n) => n.tier === 'king')).toHaveLength(1);
    expect(nodes.find((n) => n.tier === 'king')!.primary).toBe(true);
    expect(nodes.filter((n) => n.tier === 'support').length).toBeGreaterThanOrEqual(1);
    const micro = nodes.filter((n) => n.role === 'micro');
    expect(micro.length).toBeGreaterThan(0);
    expect(micro.length).toBeLessThanOrEqual(30);
    for (const m of micro) {
      expect(m.tier).toBe('micro');
      expect(m.key).toContain('~m');
      expect(m.growthScale).toBeLessThan(0.2);
    }
  });

  it('композиція: бібліотека архетипів замість «усі — списи»', () => {
    const nodes = build(makeInput());
    const archetypes = new Set(nodes.map((n) => n.archetype));
    expect(archetypes.size, `лише ${[...archetypes].join(', ')}`).toBeGreaterThanOrEqual(4);
    // Король — масивний/призматичний, ніколи голка чи уламок.
    const king = nodes.find((n) => n.primary)!;
    expect(['massive', 'prismatic']).toContain(king.archetype);
  });

  it('композиція: самооцінка зразка не нижча за поріг (максимум два проходи)', () => {
    for (const seed of ['8264-3607-EEA8', 'AAAA-BBBB-CCCC', '1111-2222-3333']) {
      const raw = makeInput();
      const input = { ...raw, seedNum: hashSeedString(seed), dna: generateArtifactDNA(seed) };
      const { score, passes } = depositMineralMassWithScore(input, computeEvolutionPressures(input));
      expect(passes).toBeLessThanOrEqual(2);
      expect(score.total, `seed ${seed}: ${JSON.stringify(score)}`).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe('bucketByFixedSize (характеризація)', () => {
  it('нові записи лише додають хвостовий бакет, старі не перенумеровуються', () => {
    const items = [
      { id: 1, date: '2025-01-01' },
      { id: 2, date: '2025-02-01' },
      { id: 3, date: '2025-03-01' },
    ];
    const before = bucketByFixedSize(items, 2);
    expect(before).toEqual([
      { index: 0, repDate: '2025-02-01', itemCount: 2 },
      { index: 1, repDate: '2025-03-01', itemCount: 1 },
    ]);
    const after = bucketByFixedSize([...items, { id: 4, date: '2025-04-01' }], 2);
    expect(after[0]).toEqual(before[0]);
    expect(after[1]).toEqual({ index: 1, repDate: '2025-04-01', itemCount: 2 });
  });
});
