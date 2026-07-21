// ============================================================
// artifactNodes — процедурна побудова вузлів еволюції з реальних даних.
// ------------------------------------------------------------
// Growth Domains (Artifact Engine — Technical Addendum v2): 5 тематичних
// доменів (Exploration/Memory/Connection/Creation/Future) навколо
// центрального 'core'-стовбура (час разом — поза системою доменів, «one
// dominant crystal»). Просторовий поділ — ТВЕРДА гарантія через непересічні
// кутові клини (dna.domainOrder), а не runtime-колізії: theta вузла
// малюється ВІД НАРОДЖЕННЯ в межах клину свого домену, тож перетин гілок
// різних доменів геометрично неможливий за побудовою, незалежно від того,
// наскільки виросте якийсь один домен. «М'які межі» (уповільнення/нахил
// біля краю клину) — суто косметичний шар поверх цієї вже безумовної
// гарантії, не колізійна фізика.
//
// «Друза, не вибух» — реальні кристалічні друзи (кварц/аметист) НЕ ростуть
// сферичним вибухом навсібіч: усі кристали нуклеюються на спільній тісній
// кореневій ділянці (одна матриця), і звідти вже ростуть угору й назовні —
// той, кому дісталось найкраще місце (центр), росте найвищим і найрівнішим
// («core» — головний стовбур), а сусідні кристали, змагаючись за простір,
// віялом відхиляються тим більше, чим ближче до краю. Тому тут `distance`
// означає НЕ «як далеко розташована основа гілки від центру» (як було
// раніше — це й давало хаотичний розкид), а «наскільки тісно основа сидить
// у спільній кореневій зоні» — завжди мала; сам «розмах» назовні дає нахил
// (phi) і довжина (growthScale), так само як у справжньому кристалі.
//
// Реєстр seed-офсетів (щоб нові додавання не колізували з існуючими):
//   +5100 + i*173        — core-гілка i
//   +7789 + id*97         — milestone
//   +3311 + id*53         — wish
//   +6203 + id*41         — goal
//   +8317 + id*47         — anniversary
//   +hash('memory')+i*71  — memory-бакет i
//   +hash('creation:S')+i*83 — creation-бакет i джерела S
//   +hash('baseline:D')+i*61 — базовий вузол домену D
//   +90210                — генерація ArtifactDNA (artifactDNA.ts)
// ============================================================
import { mulberry32, hashSeedString } from '../mulberry32';
import { daysBetween } from '../homeUtils';
import type { CrystalWish } from '../useCrystal';
import { maturityCurve } from './maturity';
import type {
  ArtifactDNA,
  ArtifactInput,
  ArtifactNode,
  DatedItem,
  EvolutionPressures,
  GrowthDomainId,
  NodeKind,
} from './artifactTypes';

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];
const WEDGE_WIDTH = (Math.PI * 2) / DOMAIN_IDS.length;

function wedgeStart(dna: ArtifactDNA, domain: GrowthDomainId): number {
  return dna.domainOrder.indexOf(domain) * WEDGE_WIDTH;
}

/**
 * Розміщення вузла всередині клину свого домену. Тверда гарантія:
 * theta завжди в [wedgeStart, wedgeStart+WEDGE_WIDTH) — інші домени фізично
 * недосяжні. «М'яка межа»: чим ближче до краю клину (edgeProximity→1), тим
 * більше вузол «нахиляється»/«сплощується» (вищий phi) — природний вигляд
 * «опору» без жодної колізійної перевірки.
 */
function placeInDomain(
  rng: () => number,
  dna: ArtifactDNA,
  domain: GrowthDomainId,
  maxTiltRad: number,
  stability: number,
): { theta: number; phi: number; edgeProximity: number } {
  const start = wedgeStart(dna, domain);
  const theta = start + rng() * WEDGE_WIDTH;
  const dampedMax = maxTiltRad * (1 - stability * 0.35);
  const distFromStart = theta - start;
  const distFromEnd = start + WEDGE_WIDTH - theta;
  const edgeProximity = 1 - Math.min(distFromStart, distFromEnd) / (WEDGE_WIDTH / 2);
  // Кут нахилу обмежено ~80° — навіть найпериферійніший супутник у справжній
  // друзі ще росте «вгору-вбік», а не вниз чи горизонтально.
  const phi = Math.min(1.4, rng() * dampedMax + edgeProximity * 0.25);
  return { theta, phi, edgeProximity };
}

/**
 * Той самий механізм, що v1 randomLean, тепер лише для 'core' — єдиного
 * kind поза системою доменів, тому досі потребує власного вільного
 * напрямкового зміщення (dna.attractorDirections). harmonySymmetry
 * («Рівномірність використання модулів → Harmony») тягне азимут до
 * рівномірного розташування по колу; ніколи не ідеально механічно.
 */
function computeLean(
  rng: () => number,
  maxTiltRad: number,
  dna: ArtifactDNA,
  harmonySymmetry: number,
  stability: number,
  slot: number,
  slotCount: number,
): { theta: number; phi: number } {
  const dampedMax = maxTiltRad * (1 - stability * 0.35);
  const groupOffset = dna.attractorDirections[slot % dna.attractorDirections.length]!;
  const rawTheta = rng() * Math.PI * 2;
  const slotTheta = groupOffset + (slot / slotCount) * Math.PI * 2;
  const theta = rawTheta * (1 - harmonySymmetry) + slotTheta * harmonySymmetry;
  const phi = rng() * dampedMax;
  return { theta, phi };
}

interface Bucket {
  /** Абсолютний (не після зрізання капом) індекс — саме він і йде в key, тому
   *  старий бакет ніколи не перенумеровується, коли з'являється новий. */
  index: number;
  repDate: string;
  itemCount: number;
}

/**
 * Групує датовані записи у бакети ФІКСОВАНОГО розміру (не «поділити на N
 * бакетів» — те резалось б при рості N). bucketIndex = floor(chronologicalRank
 * / bucketSize); нові записи лише додаються в кінець (реальні дати не
 * рухаються), тож склад і repDate СТАРИХ бакетів ніколи не змінюються —
 * з'являється лише новий хвостовий бакет. Це і робить безпечним «групувати
 * багато сирих рядків в одну гілку» під принципом «ніколи не перебудовувати».
 */
export function bucketByFixedSize(items: readonly DatedItem[], bucketSize: number): Bucket[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  const buckets: Bucket[] = [];
  let bucketIndex = 0;
  for (let i = 0; i < sorted.length; i += bucketSize, bucketIndex++) {
    const chunk = sorted.slice(i, i + bucketSize);
    buckets.push({ index: bucketIndex, repDate: chunk[chunk.length - 1]!.date, itemCount: chunk.length });
  }
  return buckets;
}

// ── 'core' — базовий приріст від самого часу разом (поза доменами) ──
const CORE_INTERVAL_DAYS = 40;
const MAX_CORE_BRANCHES = 22;

function buildCoreBranches(
  seedNum: number,
  daysTogether: number,
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  if (daysTogether <= 0) return [];
  const count = Math.min(MAX_CORE_BRANCHES, Math.floor(daysTogether / CORE_INTERVAL_DAYS) + 1);
  const symmetry = Math.min(0.6, pressures.harmony * 0.6);
  const nodes: ArtifactNode[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seedNum + 5100 + i * 173);
    const birthDay = i * CORE_INTERVAL_DAYS;
    const maturity = maturityCurve(daysTogether - birthDay);
    // Головний стовбур — найбільш вертикальний (реальний домінантний кристал
    // друзи, що дістав найкраще місце для нуклеації, росте найпрямішим).
    const { theta, phi } = computeLean(rng, 0.4, dna, symmetry, pressures.stability, i, count);
    const distance = 0.03 + rng() * 0.1; // спільна коренева зона — тісно, не віночок

    nodes.push({
      key: `core-${i}`,
      kind: 'core',
      domain: null,
      growthScale: 0.75 + rng() * 1.15,
      massScale: 0.06 + rng() * 0.07,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.35 + rng() * 0.3,
    });
  }
  return nodes;
}

// ── Exploration domain: country/city — географія як структурні мутації ──
const MAX_COUNTRY_BRANCHES = 6;
const MAX_CITY_BRANCHES = 10;

function buildPlaceBranches(
  seedNum: number,
  places: readonly { name: string; firstVisit: string }[],
  kind: 'country' | 'city',
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const cap = kind === 'country' ? MAX_COUNTRY_BRANCHES : MAX_CITY_BRANCHES;
  const [growthMin, growthRange] = kind === 'country' ? [1.9, 0.7] : [1.05, 0.5];
  const [massMin, massRange] = kind === 'country' ? [0.3, 0.12] : [0.16, 0.08];
  const [distMin, distRange] = kind === 'country' ? [0.04, 0.1] : [0.05, 0.09];
  const maxTilt = kind === 'country' ? 0.7 : 0.85;
  const sliced = places.slice(0, cap);

  return sliced.map(({ name, firstVisit }) => {
    const rng = mulberry32(seedNum + hashSeedString(`${kind}:${name}`));
    const maturity = maturityCurve(daysBetween(firstVisit), kind === 'country' ? 30 : 22);
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'exploration', maxTilt, pressures.stability);
    const distance = (distMin! + rng() * distRange!) * (1 - edgeProximity * 0.15);
    // «Подорожі → Expansion Pressure»: реальний структурний ефект — гілка
    // тягнеться далі НАЗОВНІ (більший нахил), а не основа розповзається
    // від спільної кореневої зони.
    const expandedPhi = Math.min(1.4, phi + pressures.expansion * 0.3);

    return {
      key: `${kind}-${name}`,
      kind,
      domain: 'exploration',
      label: name,
      growthScale: growthMin! + rng() * growthRange!,
      massScale: massMin! + rng() * massRange!,
      theta,
      phi: expandedPhi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.22 + rng() * 0.12,
    };
  });
}

// ── Connection domain: milestone/goal/anniversary ────────────────
const MAX_MILESTONE_BRANCHES = 6;

function buildMilestoneBranches(
  seedNum: number,
  milestones: readonly { id: number; title: string; date: string }[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const sliced = milestones.slice(-MAX_MILESTONE_BRANCHES);
  return sliced.map((m) => {
    const rng = mulberry32(seedNum + 7789 + m.id * 97);
    const maturity = maturityCurve(daysBetween(m.date), 6); // одразу вагомі, лиш трохи «доростають»
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'connection', 0.55, pressures.stability);
    const distance = (0.05 + rng() * 0.09) * (1 - edgeProximity * 0.15);

    return {
      key: `milestone-${m.id}`,
      kind: 'milestone',
      domain: 'connection',
      label: m.title,
      growthScale: 1.2 + rng() * 0.5,
      massScale: 0.2 + rng() * 0.06,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.3 + rng() * 0.15,
      emphasized: true,
    };
  });
}

function buildConnectionExtras(
  seedNum: number,
  achievedGoals: readonly DatedItem[],
  anniversaries: readonly DatedItem[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const build = (kind: 'goal' | 'anniversary', items: readonly DatedItem[], seedBase: number) =>
    items.map((item) => {
      const rng = mulberry32(seedNum + seedBase + item.id * 41);
      const maturity = maturityCurve(daysBetween(item.date), 20);
      const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'connection', 0.8, pressures.stability);
      const distance = (0.04 + rng() * 0.08) * (1 - edgeProximity * 0.15);
      return {
        key: `${kind}-${item.id}`,
        kind,
        domain: 'connection' as const,
        growthScale: 0.55 + rng() * 0.3,
        massScale: 0.1 + rng() * 0.05,
        theta,
        phi,
        distance,
        verticalJitter: rng() * 2 - 1,
        spin: rng() * Math.PI * 2,
        maturity,
        breathePhase: rng() * Math.PI * 2,
        breatheSpeed: 0.3 + rng() * 0.15,
      };
    });

  return [...build('goal', achievedGoals, 6203), ...build('anniversary', anniversaries, 8317)];
}

// ── Memory domain: photo_calendar bucketed ────────────────────────
const MEMORY_BUCKET_SIZE = 6;
const MAX_MEMORY_BUCKETS = 8;

function buildMemoryBranches(
  seedNum: number,
  memories: readonly DatedItem[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const buckets = bucketByFixedSize(memories, MEMORY_BUCKET_SIZE).slice(-MAX_MEMORY_BUCKETS);
  return buckets.map(({ index, repDate }) => {
    const rng = mulberry32(seedNum + hashSeedString('memory') + index * 71);
    const maturity = maturityCurve(daysBetween(repDate), 14);
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'memory', 0.85, pressures.stability);
    const distance = (0.04 + rng() * 0.08) * (1 - edgeProximity * 0.15);

    return {
      key: `memory-bucket-${index}`,
      kind: 'memory',
      domain: 'memory',
      growthScale: 0.4 + rng() * 0.3,
      massScale: 0.07 + rng() * 0.04,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.4 + rng() * 0.25,
    };
  });
}

// ── Creation domain: recipes/movies/books, per-source bucketed ───
type CreationSource = 'recipe' | 'movie' | 'book';
const CREATION_BUCKET_SIZE: Record<CreationSource, number> = { recipe: 3, movie: 15, book: 3 };
const MAX_CREATION_BUCKETS_PER_SOURCE = 4;

function buildCreationSource(
  seedNum: number,
  source: CreationSource,
  items: readonly DatedItem[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const buckets = bucketByFixedSize(items, CREATION_BUCKET_SIZE[source]).slice(-MAX_CREATION_BUCKETS_PER_SOURCE);
  return buckets.map(({ index, repDate }) => {
    const rng = mulberry32(seedNum + hashSeedString(`creation:${source}`) + index * 83);
    const maturity = maturityCurve(daysBetween(repDate), 16);
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'creation', 0.85, pressures.stability);
    const distance = (0.04 + rng() * 0.08) * (1 - edgeProximity * 0.15);

    return {
      key: `creation-${source}-bucket-${index}`,
      kind: 'creation',
      domain: 'creation',
      // Джерело-специфічний тон (теплий/фільмовий/гранований) читає рендерер
      // із label — ArtifactNode лишається generic, це вже інтерпретація Crystal.
      label: source,
      growthScale: 0.4 + rng() * 0.3,
      massScale: 0.07 + rng() * 0.04,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.4 + rng() * 0.25,
    };
  });
}

function buildCreationBranches(
  seedNum: number,
  recipes: readonly DatedItem[],
  movies: readonly DatedItem[],
  books: readonly DatedItem[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  return [
    ...buildCreationSource(seedNum, 'recipe', recipes, dna, pressures),
    ...buildCreationSource(seedNum, 'movie', movies, dna, pressures),
    ...buildCreationSource(seedNum, 'book', books, dna, pressures),
  ];
}

// ── Future domain: wish — виконані бажання = маленькі супутні кристалики ──
const MAX_WISH_BRANCHES = 14;

function buildWishBranches(
  seedNum: number,
  wishes: readonly CrystalWish[],
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const sliced = wishes.slice(0, MAX_WISH_BRANCHES);
  return sliced.map((w) => {
    const rng = mulberry32(seedNum + 3311 + w.id * 53);
    const maturity = maturityCurve(daysBetween(w.fulfilledAt), 10); // маленька подія — дозріває швидко
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, 'future', 0.95, pressures.stability);
    const distance = (0.04 + rng() * 0.09) * (1 - edgeProximity * 0.15);

    return {
      key: `wish-${w.id}`,
      kind: 'wish',
      domain: 'future',
      growthScale: 0.3 + rng() * 0.25,
      massScale: 0.05 + rng() * 0.03,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.5 + rng() * 0.3,
    };
  });
}

// ── «Жоден домен ніколи повністю не мовчить» — амбіентний трикл ──
// Це НЕ окремі конкуруючі шипи, а дрібна кристалічна «текстура» самої
// кореневої зони (як нерівна матриця біля основи справжньої друзи) — тому
// тісно (мала distance), низько (мала growthScale) і, свідомо, небагато
// (щоб не забивати реальні дані), рідше (довший інтервал).
const BASELINE_INTERVAL_DAYS = 260;
const MAX_BASELINE_PER_DOMAIN = 3;
const BASELINE_KIND: Record<GrowthDomainId, NodeKind> = {
  exploration: 'city',
  memory: 'memory',
  connection: 'anniversary',
  creation: 'creation',
  future: 'wish',
};

/**
 * Незалежно від активності самого домену, щохвилини (BASELINE_INTERVAL_DAYS)
 * часу разом додає йому один малесенький амбієнтний вузол — та сама ідея,
 * що й 'core', узагальнена на всі 5 доменів. Пара, яка ніколи не подорожувала,
 * все одно бачить ледь помітну, повільно густішаючу присутність Exploration
 * лише завдяки Time/Memory Pressure — без жодної окремої fallback-логіки.
 */
function buildDomainBaseline(
  seedNum: number,
  domain: GrowthDomainId,
  daysTogether: number,
  dna: ArtifactDNA,
  pressures: EvolutionPressures,
): ArtifactNode[] {
  if (daysTogether <= 0) return [];
  const count = Math.min(MAX_BASELINE_PER_DOMAIN, Math.floor(daysTogether / BASELINE_INTERVAL_DAYS) + 1);
  const nodes: ArtifactNode[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seedNum + hashSeedString(`baseline:${domain}`) + i * 61);
    const birthDay = i * BASELINE_INTERVAL_DAYS;
    const maturity = maturityCurve(daysTogether - birthDay, 45);
    const { theta, phi, edgeProximity } = placeInDomain(rng, dna, domain, 0.9, pressures.stability);
    const distance = (0.02 + rng() * 0.05) * (1 - edgeProximity * 0.15);

    nodes.push({
      key: `baseline-${domain}-${i}`,
      kind: BASELINE_KIND[domain],
      domain,
      growthScale: 0.16 + rng() * 0.12,
      massScale: 0.06 + rng() * 0.04,
      theta,
      phi,
      distance,
      verticalJitter: rng() * 2 - 1,
      spin: rng() * Math.PI * 2,
      maturity,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.4 + rng() * 0.2,
    });
  }
  return nodes;
}

export function isArtifactEmpty(input: ArtifactInput): boolean {
  return (
    input.usage.daysTogether <= 0 &&
    input.countries.length === 0 &&
    input.cities.length === 0 &&
    input.milestones.length === 0 &&
    input.wishes.length === 0 &&
    input.achievedGoals.length === 0 &&
    input.anniversaries.length === 0 &&
    input.recipes.length === 0 &&
    input.movies.length === 0 &&
    input.books.length === 0 &&
    input.memories.length === 0
  );
}

/** Будує весь список вузлів артефакту. pressures обчислюється окремо
 *  (computeEvolutionPressures) і передається сюди — та сама структура
 *  споживається й deriveClusterMaterial, тому рахується лише один раз. */
export function buildArtifactNodes(input: ArtifactInput, pressures: EvolutionPressures): ArtifactNode[] {
  const { seedNum, dna, usage } = input;

  const nodes: ArtifactNode[] = [
    ...buildCoreBranches(seedNum, usage.daysTogether, dna, pressures),
    ...buildPlaceBranches(seedNum, input.countries, 'country', dna, pressures),
    ...buildPlaceBranches(seedNum, input.cities, 'city', dna, pressures),
    ...buildMilestoneBranches(seedNum, input.milestones, dna, pressures),
    ...buildConnectionExtras(seedNum, input.achievedGoals, input.anniversaries, dna, pressures),
    ...buildMemoryBranches(seedNum, input.memories, dna, pressures),
    ...buildCreationBranches(seedNum, input.recipes, input.movies, input.books, dna, pressures),
    ...buildWishBranches(seedNum, input.wishes, dna, pressures),
    ...DOMAIN_IDS.flatMap((d) => buildDomainBaseline(seedNum, d, usage.daysTogether, dna, pressures)),
  ];

  // «Цілі/річниці/тривалість стосунків → Stability»: товщає ВСЕ, постфактум —
  // одна точка застосування замість дублювання в кожному білдері.
  for (const node of nodes) node.massScale *= 1 + pressures.stability * 0.15;

  return nodes;
}
