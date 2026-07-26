// ============================================================
// Правила виду як ФУНКЦІЯ ІСТОРІЇ (Volume II §10, crystalConstraints.ts).
// ------------------------------------------------------------
// Що саме тут доводиться:
//   1. інваріанти виду тримаються на ВСЬОМУ просторі драйверів — кристал
//      ніколи не росте вниз, нуклеює біля підошви, ховає основи; це не
//      «числа з референсу», а закон, істинний для будь-якої пари;
//   2. кожен драйвер зсуває СВОЄ правило монотонно й у задокументованому
//      напрямку (таблиця в шапці crystalConstraints.ts);
//   3. правила ІСТОРИЧНІ: дані, додані сьогодні, не переписують закон
//      жодного вже відкладеного тіла (append-only, DETERMINISM_STANDARD §3);
//   4. наскрізна реакція форми — там, де ефект достатньо сильний, щоб
//      пережити композицію.
//
// Про (4) чесно: композиція (Volume IV) перекроює маси й ранги, тож слабкі
// зсуви правил у ній тонуть. Тому наскрізні перевірки стоять лише на
// сильних зв'язках (спільний шлях → король; віхи → діти), а тонкі
// (мандри → висота кріплення, спогади → стрункість) доводяться на рівні
// самої функції правил, де вони детерміновані й фальсифіковні. Тест, який
// вимагав би від них наскрізного ефекту, був би нестабільним, а не суворим.
// ============================================================
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildArtifactNodes,
  computeEvolutionPressures,
  generateArtifactDNA,
  type ArtifactInput,
  type ArtifactNode,
} from '../index';
import { buildEvolutionTimeline, historyAt } from '../evolution';
import {
  CRYSTAL_BASELINE,
  crystalConstraintsAt,
  crystalConstraintsFrom,
  crystalShapeDrivers,
  type CrystalShapeDrivers,
} from '../species/crystalConstraints';
import { hashSeedString } from '../../mulberry32';

const SEEDS = ['8264-3607-EEA8', '1A2B-3C4D-5E6F'] as const;
const NOW = new Date('2026-07-21T12:00:00');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeInput(seed: string, o: Partial<ArtifactInput> = {}): ArtifactInput {
  const memories = [480, 410, 350, 290, 220, 160, 45].map((age, i) => ({ id: i + 1, date: isoDaysAgo(age) }));
  return {
    seedNum: hashSeedString(seed),
    dna: generateArtifactDNA(seed),
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
    recipes: [1, 2, 3].map((id, i) => ({ id, date: isoDaysAgo(90 - i * 30) })),
    movies: [
      { id: 1, date: isoDaysAgo(70) },
      { id: 2, date: isoDaysAgo(50) },
    ],
    books: [],
    memoriesCount: memories.length,
    memories,
    ...o,
  };
}

const build = (input: ArtifactInput): ArtifactNode[] => buildArtifactNodes(input, computeEvolutionPressures(input));

const ZERO: CrystalShapeDrivers = { travel: 0, bond: 0, memory: 0, balance: 0, wishes: 0, events: 0, photos: 0 };
const DRIVER_NAMES = Object.keys(ZERO) as (keyof CrystalShapeDrivers)[];
const only = (name: keyof CrystalShapeDrivers, value: number): CrystalShapeDrivers => ({ ...ZERO, [name]: value });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('правила виду — інваріанти на всьому просторі драйверів', () => {
  it('нульова історія = базова лінія виду', () => {
    expect(crystalConstraintsFrom(ZERO).siteTMax).toBe(CRYSTAL_BASELINE.siteTMax);
    expect(crystalConstraintsFrom(ZERO).burial).toBe(CRYSTAL_BASELINE.burial);
  });

  it('жодна комбінація історії не порушує геологію кристала', () => {
    // Усі кути простору драйверів + середина: якби формула могла дати
    // від'ємну вертикаль, стелю нижче підлоги чи шанс колонії >1, це
    // вилізло б саме на кутах.
    const corners: CrystalShapeDrivers[] = [];
    for (let mask = 0; mask < 1 << DRIVER_NAMES.length; mask++) {
      const d = { ...ZERO };
      DRIVER_NAMES.forEach((name, i) => {
        d[name] = mask & (1 << i) ? 1 : 0;
      });
      corners.push(d);
    }
    corners.push({ travel: 0.5, bond: 0.5, memory: 0.5, balance: 0.5, wishes: 0.5, events: 0.5, photos: 0.5 });

    for (const d of corners) {
      const c = crystalConstraintsFrom(d);
      const at = JSON.stringify(d);
      // Кристал не росте вниз — головне правило виду.
      expect(c.minUpwardMain, at).toBeGreaterThan(0);
      expect(c.minUpwardRare, at).toBeGreaterThan(0);
      expect(c.diagonalChance, at).toBeGreaterThanOrEqual(0);
      expect(c.diagonalChance, at).toBeLessThanOrEqual(1);
      // Нуклеація лишається біля підошви господаря за БУДЬ-ЯКОЇ історії.
      expect(c.siteTMin, at).toBeGreaterThan(0);
      expect(c.siteTMin, at).toBeLessThan(c.siteTMax);
      expect(c.siteTMax, at).toBeLessThanOrEqual(0.35);
      // Основи вростають, але не наскрізь.
      expect(c.burial, at).toBeGreaterThan(0);
      expect(c.burial, at).toBeLessThan(1);
      // Ієрархія: діти ніколи не переростають короля.
      expect(c.monarch.heightCeiling, at).toBeGreaterThan(0);
      expect(c.monarch.heightCeiling, at).toBeLessThan(1);
      // Шанси лишаються ймовірностями; спідниця має де поміститись.
      for (const [kind, chance] of Object.entries(c.colonyChance)) {
        expect(chance, `${at} / ${kind}`).toBeGreaterThan(0);
        expect(chance, `${at} / ${kind}`).toBeLessThan(1);
      }
      expect(c.colonyMaxChance, at).toBeLessThanOrEqual(1);
      expect(c.minAngularSeparation, at).toBeGreaterThan(0);
      expect(c.slenderness, at).toBeGreaterThan(1);
      expect(c.monarchSlenderness, at).toBeGreaterThan(1);
      // Курган спадає від осі й ніколи не піднімає тіло вище номіналу.
      const near = c.moundFalloff(0);
      const far = c.moundFalloff(3);
      expect(near, at).toBeLessThanOrEqual(1);
      expect(far, at).toBeGreaterThan(0);
      expect(far, at).toBeLessThan(near);
    }
  });
});

describe('правила виду — кожен драйвер зсуває своє правило', () => {
  // Таблиця дзеркалить шапку crystalConstraints.ts. Тест падає і тоді, коли
  // зв'язок зникає, і тоді, коли розвертається — саме це робить його
  // перевіркою наміру, а не переписом реалізації.
  const cases: [keyof CrystalShapeDrivers, string, (c: ReturnType<typeof crystalConstraintsFrom>) => number, 'up' | 'down'][] = [
    ['travel', 'друза підіймається по королю', (c) => c.siteTMax, 'up'],
    ['bond', 'основи глибше вростають', (c) => c.burial, 'up'],
    ['bond', 'маса випрямляється вгору', (c) => c.minUpwardMain, 'up'],
    ['bond', 'менше діагоналей', (c) => c.diagonalChance, 'down'],
    ['bond', 'король сильніше домінує', (c) => c.monarch.heightCeiling, 'down'],
    ['memory', 'шпилі стрункішають', (c) => c.slenderness, 'up'],
    ['balance', 'курган пологішає', (c) => c.moundFalloff(1), 'up'],
    ['wishes', 'більше дрібних тіл у спідниці', (c) => c.colonyChance.wish, 'up'],
    ['wishes', 'стеля колоній вища', (c) => c.colonyMaxChance, 'up'],
    ['wishes', 'спідниця тісніша', (c) => c.minAngularSeparation, 'down'],
    ['events', 'більше дочірніх кристалів', (c) => c.colonyChance.milestone, 'up'],
    ['photos', 'бічні шпилі тягнуться вище', (c) => c.moundFalloff(1), 'up'],
    ['photos', 'стеля висоти дітей піднімається', (c) => c.monarch.heightCeiling, 'up'],
  ];

  it('розміри самого короля НЕ залежать від драйверів — і це навмисно', () => {
    // `baseLength`/`lengthGain`/`radiusBoost` читає лише гілка монарха, а
    // монарх — найстаріша подія маси, тож його історія завжди порожня
    // (`historyAt(timeline, daysTogether)` → bond = 0). Прив'язати їх до
    // драйверів означало б написати формулу, яка ніколи не спрацьовує.
    // Король росте від ВЛАСНОГО віку (event.ageDays), і саме це перевіряє
    // наскрізний тест «довший спільний шлях → вищий і товщий король».
    const base = crystalConstraintsFrom(ZERO);
    for (const d of DRIVER_NAMES) {
      const c = crystalConstraintsFrom(only(d, 1));
      expect(c.monarch.baseLength, d).toBe(base.monarch.baseLength);
      expect(c.monarch.lengthGain, d).toBe(base.monarch.lengthGain);
      expect(c.monarch.radiusBoost, d).toBe(base.monarch.radiusBoost);
      expect(c.monarch.growthDays, d).toBe(base.monarch.growthDays);
    }
  });

  for (const [driver, effect, read, direction] of cases) {
    it(`${driver} → ${effect}`, () => {
      const low = read(crystalConstraintsFrom(only(driver, 0)));
      const mid = read(crystalConstraintsFrom(only(driver, 0.5)));
      const high = read(crystalConstraintsFrom(only(driver, 1)));
      if (direction === 'up') {
        expect(mid).toBeGreaterThan(low);
        expect(high).toBeGreaterThan(mid);
      } else {
        expect(mid).toBeLessThan(low);
        expect(high).toBeLessThan(mid);
      }
    });
  }

  it('драйвери не «протікають»: кожен рухає лише свої правила', () => {
    // Мандри не мусять робити короля товстішим, а бажання — глибшими
    // основи. Інакше формула перестала б читатись як таблиця в шапці.
    const base = crystalConstraintsFrom(ZERO);
    const travel = crystalConstraintsFrom(only('travel', 1));
    expect(travel.burial).toBe(base.burial);
    expect(travel.monarch.heightCeiling).toBe(base.monarch.heightCeiling);
    expect(travel.colonyChance.wish).toBe(base.colonyChance.wish);
    const wishes = crystalConstraintsFrom(only('wishes', 1));
    expect(wishes.burial).toBe(base.burial);
    expect(wishes.siteTMax).toBe(base.siteTMax);
    expect(wishes.slenderness).toBe(base.slenderness);
  });
});

describe('правила виду — історичність (append-only)', () => {
  it('дані, додані сьогодні, не змінюють правило жодного старшого шару', () => {
    const before = buildEvolutionTimeline(makeInput(SEEDS[0]));
    const after = buildEvolutionTimeline(
      makeInput(SEEDS[0], {
        wishes: [
          ...makeInput(SEEDS[0]).wishes,
          { id: 99, fulfilledAt: isoDaysAgo(0) },
        ],
        milestones: [...makeInput(SEEDS[0]).milestones, { id: 88, title: 'Переїзд', date: isoDaysAgo(0) }],
      }),
    );
    for (const age of [500, 400, 300, 200, 100, 1]) {
      const a = crystalConstraintsAt(before, age);
      const b = crystalConstraintsAt(after, age);
      expect(crystalShapeDrivers(historyAt(before, age)), `вік ${age}: драйвери`).toEqual(
        crystalShapeDrivers(historyAt(after, age)),
      );
      expect(b.burial, `вік ${age}: burial`).toBe(a.burial);
      expect(b.colonyChance.wish, `вік ${age}: шанс колонії`).toBe(a.colonyChance.wish);
      expect(b.siteTMax, `вік ${age}: висота кріплення`).toBe(a.siteTMax);
    }
    // …а «сьогодні» нові дані видно — інакше перевірка вище була б вакуумною.
    expect(crystalConstraintsAt(after, 0).colonyChance.wish).toBeGreaterThan(
      crystalConstraintsAt(before, 0).colonyChance.wish,
    );
  });

  it('молодші шари бачать більше історії, ніж старші', () => {
    const timeline = buildEvolutionTimeline(makeInput(SEEDS[0]));
    const old = crystalConstraintsAt(timeline, 480);
    const young = crystalConstraintsAt(timeline, 0);
    expect(young.siteTMax).toBeGreaterThan(old.siteTMax);
    expect(young.burial).toBeGreaterThan(old.burial);
  });
});

describe('форма реагує на життя пари (наскрізно)', () => {
  it('довший спільний шлях → вищий і товщий король', () => {
    for (const seed of SEEDS) {
      const base = makeInput(seed);
      const longer = makeInput(seed, {
        usage: { ...base.usage, daysTogether: 3000 },
        achievedGoals: Array.from({ length: 8 }, (_, i) => ({ id: 400 + i, date: isoDaysAgo(2900 - i * 100) })),
        anniversaries: Array.from({ length: 5 }, (_, i) => ({ id: 500 + i, date: isoDaysAgo(2800 - i * 300) })),
      });
      const kingA = build(base).find((n) => n.primary)!;
      const kingB = build(longer).find((n) => n.primary)!;
      expect(kingB.growthScale, `${seed}: король не виріс`).toBeGreaterThan(kingA.growthScale);
      expect(kingB.massScale, `${seed}: король не потовщав`).toBeGreaterThan(kingA.massScale);
    }
  });

  it('більше важливих подій → більше дочірніх кристалів', () => {
    for (const seed of SEEDS) {
      const base = build(makeInput(seed));
      const rich = build(
        makeInput(seed, {
          milestones: Array.from({ length: 10 }, (_, i) => ({
            id: 200 + i,
            title: `Подія ${i}`,
            date: isoDaysAgo(470 - i * 20),
          })),
        }),
      );
      const dominants = (n: ArtifactNode[]) => n.filter((b) => b.role === 'dominant').length;
      expect(dominants(rich), `${seed}: не побільшало тіл`).toBeGreaterThan(dominants(base));
      // Щільність колоній тут НЕ перевіряється, і це вимірювання, а не
      // поблажка: шанс колонії для віх справді росте (тест
      // «events → більше дочірніх кристалів» вище), але наскрізно його
      // з'їдає тіснота — 10 віх додають десять домінантних тіл, і
      // супутникам просто немає куди сісти (candidateFits → defer).
      // На сіді 1A2B-3C4D-5E6F частка супутників падає з 0.107 до 0.031.
      // Стверджувати протилежне означало б записати в тест бажане.
    }
  });

  it('більше виконаних бажань → густіша маса дрібних тіл', () => {
    for (const seed of SEEDS) {
      const base = build(makeInput(seed));
      const rich = build(
        makeInput(seed, {
          wishes: Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, fulfilledAt: isoDaysAgo(460 - i * 5) })),
        }),
      );
      expect(rich.length, `${seed}: спідниця не наросла`).toBeGreaterThan(base.length);
    }
  });
});

describe('фото з датами — умова, за якої вони взагалі мають право на форму', () => {
  const datedPhotos = (count: number, oldestAge: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      date: isoDaysAgo(Math.max(1, oldestAge - Math.floor((i * oldestAge) / Math.max(1, count)))),
    }));

  it('без дат драйвер форми = 0, хоч агрегат і видно', () => {
    // Це головна захисна умова: недатований агрегат `historyAt` віддає на
    // БУДЬ-ЯКИЙ вік, тож якби правила його читали, одне завантажене фото
    // зрушило б усю вже відкладену масу.
    const timeline = buildEvolutionTimeline(makeInput(SEEDS[0])); // usage.photos = 40, дат немає
    for (const age of [500, 300, 0]) {
      const counts = historyAt(timeline, age);
      expect(counts.photos, `вік ${age}`).toBe(40);
      expect(counts.photosDated, `вік ${age}: недатовані фото полізли у форму`).toBe(0);
      expect(crystalShapeDrivers(counts).photos, `вік ${age}`).toBe(0);
    }
  });

  it('з датами рахунок стає історичним', () => {
    const timeline = buildEvolutionTimeline(
      makeInput(SEEDS[0], { photos: datedPhotos(60, 480), usage: { ...makeInput(SEEDS[0]).usage, photos: 60 } }),
    );
    const old = historyAt(timeline, 400);
    const today = historyAt(timeline, 0);
    expect(old.photosDated).toBeGreaterThan(0);
    expect(today.photosDated).toBe(60);
    expect(old.photosDated, 'на старий вік видно менше фото, ніж сьогодні').toBeLessThan(today.photosDated);
    expect(crystalShapeDrivers(today).photos).toBeGreaterThan(crystalShapeDrivers(old).photos);
  });

  it('матеріал не змінюється від того, датовані фото чи ні', () => {
    // Обидві форми на віці 0 дають той самий рахунок, тож Refinement
    // Pressure (полірування, прозорість, джиттер граней) лишається тою
    // самою — датування додає ІСТОРІЮ, а не новий факт.
    const base = makeInput(SEEDS[0]);
    const withDates = makeInput(SEEDS[0], { photos: datedPhotos(40, 480) });
    expect(computeEvolutionPressures(withDates).refinement).toBe(computeEvolutionPressures(base).refinement);
  });

  it('фото, завантажене СЬОГОДНІ, не зрушує жодне вже відкладене тіло', () => {
    // Той самий інваріант, що в deposition.test.ts, але для нового зв'язку
    // «фото → форма»: без цієї перевірки датування фото було б рівно тим
    // порушенням append-only, від якого ми його й захищали.
    const before = makeInput(SEEDS[0], {
      photos: datedPhotos(40, 480),
      usage: { ...makeInput(SEEDS[0]).usage, photos: 40 },
    });
    const after = makeInput(SEEDS[0], {
      photos: [...datedPhotos(40, 480), { id: 999, date: isoDaysAgo(0) }],
      usage: { ...makeInput(SEEDS[0]).usage, photos: 41 },
    });
    const byKey = new Map(build(after).map((n) => [n.key, n]));
    for (const node of build(before)) {
      const grown = byKey.get(node.key);
      if (grown === undefined) continue; // декоративні тіла композитор може ховати
      expect(grown.growthScale, `${node.key} змінив висоту від нового фото`).toBe(node.growthScale);
      expect(grown.anchor, `${node.key} зрушив від нового фото`).toEqual(node.anchor);
    }
    // …і водночас нове фото видно «сьогодні» — інакше перевірка вакуумна.
    const tl = buildEvolutionTimeline(after);
    expect(historyAt(tl, 0).photosDated).toBe(41);
  });

  it('більше фото → вищі бічні шпилі', () => {
    for (const seed of SEEDS) {
      const few = makeInput(seed, { photos: datedPhotos(5, 480), usage: { ...makeInput(seed).usage, photos: 5 } });
      const many = makeInput(seed, { photos: datedPhotos(400, 480), usage: { ...makeInput(seed).usage, photos: 400 } });
      const meanChild = (nodes: ArtifactNode[]) => {
        const kids = nodes.filter((n) => !n.primary && n.role === 'dominant');
        return kids.reduce((a, n) => a + n.growthScale, 0) / kids.length;
      };
      const tallest = (nodes: ArtifactNode[]) =>
        Math.max(...nodes.filter((n) => !n.primary).map((n) => n.growthScale));
      expect(meanChild(build(many)), `${seed}: середній шпиль не виріс`).toBeGreaterThan(meanChild(build(few)));
      expect(tallest(build(many)), `${seed}: найвищий шпиль не виріс`).toBeGreaterThan(tallest(build(few)));
      // Але король усе одно домінує — стеля піднімається, а не зникає.
      const king = build(many).find((n) => n.primary)!;
      expect(tallest(build(many))).toBeLessThan(king.growthScale * 0.6);
    }
  });
});
