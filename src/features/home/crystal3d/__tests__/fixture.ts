// ============================================================
// Фікстура геометричних і матеріальних тестів: реальна маса з рушія.
// ------------------------------------------------------------
// Навмисно НЕ синтетичні «два циліндри»: перевіряти обробку стику треба на
// тій самій композиції, що йде на екран пари, — інакше тест зелений на
// іграшці й сліпий до справжнього кристала.
//
// Конвеєр не дублюється: `buildMass` викликає той самий `publishCrystal`,
// що й сцена. Якби фікстура складала кроки самотужки, тести перевіряли б
// свою власну послідовність, а не ту, що йде користувачеві.
// ============================================================
import {
  buildArtifactNodes,
  computeEvolutionPressures,
  generateArtifactDNA,
  type ArtifactInput,
} from '../../artifact';
import { hashSeedString } from '../../mulberry32';
import { deriveClusterBranch, deriveClusterMaterial, type ClusterBranch, type ClusterMaterial } from '../crystalCluster';
import { publishCrystal, type PublishedBody, type PublishedCrystal, type PublishOptions } from '../crystalPublication';
import type { HostSolid } from '../geometry/hostBody';
import type { TrimStats } from '../geometry/junctionTrim';
import type { MaterialEntry } from '../material/validateMaterial';
import type { ShellEntry } from '../geometry/validateShell';
import type * as THREE from 'three';

/** Записані детерміновані сіди (правило `.claude/rules/tests.md`). */
export const SEEDS = ['8264-3607-EEA8', '1A2B-3C4D-5E6F', 'DEAD-BEEF-0001', '0000-1111-2222'] as const;

const NOW = new Date('2026-07-21T12:00:00');

function isoDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Обсяг прожитого — щоб тести могли питати «а для пари з трьома подіями?».
 *  Кристал мусить лишатись кристалом на всьому діапазоні, інакше правила
 *  виду підігнані під один набір даних. */
export type DataVolume = 'sparse' | 'typical' | 'rich' | 'backfilled';

export function makeInput(seed: string, volume: DataVolume = 'typical'): ArtifactInput {
  if (volume === 'sparse') return sparseInput(seed);
  if (volume === 'rich') return richInput(seed);
  if (volume === 'backfilled') return backfilledInput(seed);
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
    // Фото датовані (Storage віддає created_at) — інакше тести структури
    // сліпі до драйвера `photos` у правилах виду.
    photos: Array.from({ length: 40 }, (_, i) => ({ id: i + 1, date: isoDaysAgo(470 - i * 11) })),
    ...(seed === SEEDS[3] ? { books: [{ id: 1, date: isoDaysAgo(210) }] } : {}),
  };
}

/** Пара, що тільки почала: три записи й пів року разом. */
function sparseInput(seed: string): ArtifactInput {
  return {
    seedNum: hashSeedString(seed),
    dna: generateArtifactDNA(seed),
    usage: {
      daysTogether: 180,
      photos: 3,
      places: 1,
      moviesWatched: 0,
      booksRead: 0,
      wishesDone: 0,
      goalsAchieved: 0,
      anniversaries: 0,
      recipesSaved: 0,
      distinctCountries: 0,
      milestones: 1,
      totalSaved: 0,
    },
    countries: [],
    cities: [{ name: 'Kyiv', firstVisit: isoDaysAgo(150) }],
    milestones: [{ id: 1, title: 'Перше побачення', date: isoDaysAgo(170) }],
    wishes: [],
    achievedGoals: [],
    anniversaries: [],
    recipes: [],
    movies: [],
    books: [],
    memoriesCount: 1,
    memories: [{ id: 1, date: isoDaysAgo(60) }],
    photos: [1, 2, 3].map((id, i) => ({ id, date: isoDaysAgo(140 - i * 50) })),
  };
}

/**
 * НАЙВАЖЛИВІША форма даних, якої тут бракувало: стосункам роки, а всі
 * записи внесені за останній місяць. Саме так виглядає реальна пара, яка
 * щойно почала користуватись застосунком — і саме на ній кристал ламався.
 *
 * Числа зняті з бази власника (2026-07-26): 1308 днів разом, уся історія
 * створена 16.06–26.07. Наслідок був структурний: король росте від ВІКУ
 * СТОСУНКІВ (2.4 завдовжки), а кожне дата-тіло — від власного, свіжого
 * запису, тож 14 із 48 тіл після зрізу виявлялись порожні, а половина
 * видимих була коротша за радіус короля. На екрані — моноліт і крихти.
 */
function backfilledInput(seed: string): ArtifactInput {
  const spread = (count: number, from: number, to: number) =>
    Array.from({ length: count }, (_, i) => from - Math.round(((from - to) * i) / Math.max(1, count - 1)));
  return {
    seedNum: hashSeedString(seed),
    dna: generateArtifactDNA(seed),
    usage: {
      daysTogether: 1308,
      photos: 50,
      places: 26,
      moviesWatched: 112,
      booksRead: 0,
      wishesDone: 3,
      goalsAchieved: 0,
      anniversaries: 4,
      recipesSaved: 3,
      distinctCountries: 1,
      milestones: 1,
      totalSaved: 0,
    },
    countries: [{ name: 'Ukraine', firstVisit: isoDaysAgo(39) }],
    cities: spread(26, 39, 4).map((age, i) => ({ name: `City ${i}`, firstVisit: isoDaysAgo(age) })),
    milestones: [{ id: 1, title: 'Віха', date: isoDaysAgo(13) }],
    wishes: spread(3, 21, 2).map((age, i) => ({ id: 200 + i, fulfilledAt: isoDaysAgo(age) })),
    achievedGoals: [],
    // Річниці — єдине, що справді старе: вони рахуються від дат стосунків.
    anniversaries: [1526, 1391, 1308, 13].map((age, i) => ({ id: 400 + i, date: isoDaysAgo(age) })),
    recipes: spread(3, 6, 4).map((age, i) => ({ id: 500 + i, date: isoDaysAgo(age) })),
    movies: spread(112, 40, 8).map((age, i) => ({ id: 600 + i, date: isoDaysAgo(age) })),
    books: [],
    memoriesCount: 23,
    memories: spread(23, 36, 6).map((age, i) => ({ id: 800 + i, date: isoDaysAgo(age) })),
    photos: spread(50, 39, 1).map((age, i) => ({ id: 900 + i, date: isoDaysAgo(age) })),
  };
}

/** Пара з десятиліттям спільного життя і сотнею записів. */
function richInput(seed: string): ArtifactInput {
  const span = 3600;
  const spread = (count: number, step: number) => Array.from({ length: count }, (_, i) => span - 60 - i * step);
  return {
    seedNum: hashSeedString(seed),
    dna: generateArtifactDNA(seed),
    usage: {
      daysTogether: span,
      photos: 400,
      places: 40,
      moviesWatched: 90,
      booksRead: 30,
      wishesDone: 24,
      goalsAchieved: 12,
      anniversaries: 9,
      recipesSaved: 30,
      distinctCountries: 12,
      milestones: 14,
      totalSaved: 90_000,
    },
    countries: spread(12, 280).map((age, i) => ({ name: `Country ${i}`, firstVisit: isoDaysAgo(age) })),
    cities: spread(28, 120).map((age, i) => ({ name: `City ${i}`, firstVisit: isoDaysAgo(age) })),
    milestones: spread(14, 240).map((age, i) => ({ id: 100 + i, title: `Віха ${i}`, date: isoDaysAgo(age) })),
    wishes: spread(24, 140).map((age, i) => ({ id: 200 + i, fulfilledAt: isoDaysAgo(age) })),
    achievedGoals: spread(12, 280).map((age, i) => ({ id: 300 + i, date: isoDaysAgo(age) })),
    anniversaries: spread(9, 365).map((age, i) => ({ id: 400 + i, date: isoDaysAgo(age) })),
    recipes: spread(30, 110).map((age, i) => ({ id: 500 + i, date: isoDaysAgo(age) })),
    movies: spread(90, 38).map((age, i) => ({ id: 600 + i, date: isoDaysAgo(age) })),
    books: spread(30, 115).map((age, i) => ({ id: 700 + i, date: isoDaysAgo(age) })),
    memoriesCount: 60,
    memories: spread(60, 58).map((age, i) => ({ id: 800 + i, date: isoDaysAgo(age) })),
    photos: spread(400, 8).map((age, i) => ({ id: 900 + i, date: isoDaysAgo(Math.max(1, age)) })),
  };
}

export interface BuiltBody {
  branch: ClusterBranch;
  solid: HostSolid;
  geometry: THREE.BufferGeometry;
  stats: TrimStats;
}

export interface BuiltMass {
  material: ClusterMaterial;
  solids: Map<string, HostSolid>;
  bodies: BuiltBody[];
  published: PublishedCrystal;
}

export function buildBranches(
  seed: string,
  volume: DataVolume = 'typical',
): { branches: ClusterBranch[]; material: ClusterMaterial } {
  const input = makeInput(seed, volume);
  const pressures = computeEvolutionPressures(input);
  return {
    branches: buildArtifactNodes(input, pressures).map((n) => deriveClusterBranch(n, input.dna)),
    material: deriveClusterMaterial(pressures),
  };
}

const toBuiltBody = (b: PublishedBody): BuiltBody => ({
  branch: b.branch,
  solid: b.solid,
  geometry: b.geometry,
  stats: b.trim,
});

/** Повна маса — рівно тим конвеєром, що й у сцені. */
export function buildMass(seed: string, options: PublishOptions = {}): BuiltMass {
  const { branches, material } = buildBranches(seed);
  const published = publishCrystal(branches, material, options);
  return {
    material,
    solids: new Map(published.bodies.map((b) => [b.branch.key, b.solid])),
    bodies: published.bodies.map(toBuiltBody),
    published,
  };
}

export const toShellEntries = (mass: BuiltMass): ShellEntry[] =>
  mass.bodies.map(({ solid, branch, geometry }) => ({ solid, hostKey: branch.hostKey, geometry }));

export const toMaterialEntries = (mass: BuiltMass): MaterialEntry[] =>
  mass.bodies.map(({ branch, solid, geometry }) => ({ branch, solid, geometry }));
