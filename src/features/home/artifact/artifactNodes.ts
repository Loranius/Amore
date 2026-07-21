// ============================================================
// artifactNodes — процедурна побудова ІЄРАРХІЇ росту з реальних даних.
// ------------------------------------------------------------
// Organic Growth Rules (переписано за прямим запитом користувача — «looks
// like a collection of separate spikes», не «assembled»):
//
// 1. Жоден вузол не з'являється в порожнечі. Кожна гілка (крім самої
//    першої, насіннєвої) виростає з ПОВЕРХНІ конкретного старшого вузла
//    (`parentKey`) — точка появи (origin) обчислюється з РЕАЛЬНОЇ позиції
//    й напрямку батька, а не зі спільної абстрактної «кореневої зони».
// 2. Напрямок успадковується від батька з малою випадковою мутацією
//    (vec3.ts::randomConePerturbation), а не рахується незалежно — тому
//    в межах одного «роду» гілки схожі за орієнтацією («growth families»).
// 3. Точка прикріплення зсунута вбік від осі батька на частку його
//    товщини (не по центру) і рідко «в мінус» — тому основа дочірньої
//    гілки візуально перекривається/ховається в батьківській поверхні
//    («embedded bases», «hide each other's base»), а не стоїть поруч.
// 4. Хто кому стає батьком — детерміновано-випадковий вибір із «пулу
//    недавніх» вузлів, із перевагою (а) недавності (recency bias — це і
//    дає природні скупчення в одному місці, а не рівномірний розподіл)
//    і (б) того самого домену, коли є з чого вибрати. Домени БІЛЬШЕ НЕ
//    мають жорсткого кутового клину (див. artifactTypes.ts::domainOrder) —
//    вони можуть вільно зростатися один в одного, як справжній друз.
// 5. Увесь артефакт — ОДНЕ дерево (єдина хронологія: core-тики й реальні
//    події одного домену впереміш, відсортовані за віком), а не 5+1
//    незалежних систем — «one continuously evolving mineral organism».
//
// Детермінізм / «ніколи не перебудовувати»: кожен елемент має ВЛАСНИЙ,
// незалежний seed (той самий реєстр офсетів, що й раніше) — вибір батька,
// точка прикріплення, мутація напрямку тощо ВСІ тягнуться з ЦЬОГО ОДНОГО
// потоку, а не з якогось спільного глобального лічильника draw'ів. Це
// означає, що вигляд вузла X залежить лише від (а) його власного seed і
// (б) ЯКІ інші вузли існують хронологічно ДО нього — не від того, скільки
// випадкових чисел «спожили» інші, незв'язані вузли. Єдине визнане
// обмеження: якщо в БД заднім числом з'являється подія зі СТАРОЮ датою
// (ретроактивний backfill), вона вставиться РАНІШЕ в хронологію і змінить
// пул можливих батьків для всього, що йде після неї — прийнятний
// компроміс, що вже існував і раніше (maturity/вік теж перераховується
// заднім числом), а не нова крихкість.
//
// Реєстр seed-офсетів (щоб нові додавання не колізували з існуючими):
//   +5100 + i*173        — core-тик i
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
import {
  addVec,
  length,
  randomConePerturbation,
  randomPerpendicular,
  scaleVec,
  sphericalToVec3,
  subtractVec,
  type Vec3,
} from './vec3';
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

// ── Крок 1: «сировина» росту — kind-незалежний опис події ще без позиції ──
interface GrowthEvent {
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  label?: string;
  /** Дні від початку стосунків (спільна вісь часу для сортування ВСІХ
   *  подій разом — і core-тиків, і реальних дат). */
  birthDay: number;
  maturityHalfLife: number;
  growthRange: readonly [number, number];
  massRange: readonly [number, number];
  breatheSpeedRange: readonly [number, number];
  /** Максимальний кут (рад) мутації напрямку відносно батька для цього kind. */
  maxMutationRad: number;
  emphasized?: boolean;
  /** Власний, незалежний seed цієї події — єдине джерело всіх її випадкових рішень. */
  seed: number;
}

function daysSinceStart(daysTogether: number, realDate: string): number {
  return daysTogether - daysBetween(realDate);
}

// ── 'core' — базовий приріст від самого часу разом ────────────────
const CORE_INTERVAL_DAYS = 40;
const MAX_CORE_BRANCHES = 22;

function coreEvents(seedNum: number, daysTogether: number): GrowthEvent[] {
  if (daysTogether <= 0) return [];
  const count = Math.min(MAX_CORE_BRANCHES, Math.floor(daysTogether / CORE_INTERVAL_DAYS) + 1);
  return Array.from({ length: count }, (_, i) => ({
    key: `core-${i}`,
    kind: 'core' as const,
    domain: null,
    birthDay: i * CORE_INTERVAL_DAYS,
    maturityHalfLife: 18,
    growthRange: [0.4, 0.75] as const,
    massRange: [0.06, 0.13] as const,
    breatheSpeedRange: [0.35, 0.65] as const,
    // Стовбур лишається найпрямішим — реальний домінантний кристал друзи,
    // що дістав найкраще місце для нуклеації, росте найрівніше.
    maxMutationRad: 0.32,
    seed: seedNum + 5100 + i * 173,
  }));
}

// ── Exploration: country/city ─────────────────────────────────────
const MAX_COUNTRY_BRANCHES = 6;
const MAX_CITY_BRANCHES = 10;

function placeEvents(
  seedNum: number,
  daysTogether: number,
  places: readonly { name: string; firstVisit: string }[],
  kind: 'country' | 'city',
): GrowthEvent[] {
  const cap = kind === 'country' ? MAX_COUNTRY_BRANCHES : MAX_CITY_BRANCHES;
  const sliced = places.slice(0, cap);
  const growthRange: readonly [number, number] = kind === 'country' ? [0.8, 1.1] : [0.45, 0.68];
  const massRange: readonly [number, number] = kind === 'country' ? [0.3, 0.42] : [0.16, 0.24];
  const maxMutationRad = kind === 'country' ? 0.55 : 0.62;

  return sliced.map(({ name, firstVisit }) => ({
    key: `${kind}-${name}`,
    kind,
    domain: 'exploration' as const,
    label: name,
    birthDay: daysSinceStart(daysTogether, firstVisit),
    maturityHalfLife: kind === 'country' ? 30 : 22,
    growthRange,
    massRange,
    breatheSpeedRange: [0.22, 0.34] as const,
    maxMutationRad,
    seed: seedNum + hashSeedString(`${kind}:${name}`),
  }));
}

// ── Connection: milestone/goal/anniversary ────────────────────────
const MAX_MILESTONE_BRANCHES = 6;

function milestoneEvents(
  seedNum: number,
  daysTogether: number,
  milestones: readonly { id: number; title: string; date: string }[],
): GrowthEvent[] {
  const sliced = milestones.slice(-MAX_MILESTONE_BRANCHES);
  return sliced.map((m) => ({
    key: `milestone-${m.id}`,
    kind: 'milestone' as const,
    domain: 'connection' as const,
    label: m.title,
    birthDay: daysSinceStart(daysTogether, m.date),
    maturityHalfLife: 6, // одразу вагомі, лиш трохи «доростають»
    growthRange: [0.55, 0.75] as const,
    massRange: [0.2, 0.26] as const,
    breatheSpeedRange: [0.3, 0.45] as const,
    maxMutationRad: 0.45,
    emphasized: true,
    seed: seedNum + 7789 + m.id * 97,
  }));
}

function connectionExtraEvents(
  seedNum: number,
  daysTogether: number,
  achievedGoals: readonly DatedItem[],
  anniversaries: readonly DatedItem[],
): GrowthEvent[] {
  const build = (kind: 'goal' | 'anniversary', items: readonly DatedItem[], seedBase: number) =>
    items.map((item) => ({
      key: `${kind}-${item.id}`,
      kind,
      domain: 'connection' as const,
      birthDay: daysSinceStart(daysTogether, item.date),
      maturityHalfLife: 20,
      growthRange: [0.55, 0.85] as const,
      massRange: [0.1, 0.15] as const,
      breatheSpeedRange: [0.3, 0.45] as const,
      maxMutationRad: 0.6,
      seed: seedNum + seedBase + item.id * 41,
    }));

  return [...build('goal', achievedGoals, 6203), ...build('anniversary', anniversaries, 8317)];
}

// ── Memory: photo_calendar bucketed ───────────────────────────────
const MEMORY_BUCKET_SIZE = 6;
const MAX_MEMORY_BUCKETS = 8;

function memoryEvents(seedNum: number, daysTogether: number, memories: readonly DatedItem[]): GrowthEvent[] {
  const buckets = bucketByFixedSize(memories, MEMORY_BUCKET_SIZE).slice(-MAX_MEMORY_BUCKETS);
  return buckets.map(({ index, repDate }) => ({
    key: `memory-bucket-${index}`,
    kind: 'memory' as const,
    domain: 'memory' as const,
    birthDay: daysSinceStart(daysTogether, repDate),
    maturityHalfLife: 14,
    growthRange: [0.4, 0.7] as const,
    massRange: [0.07, 0.11] as const,
    breatheSpeedRange: [0.4, 0.65] as const,
    maxMutationRad: 0.65,
    seed: seedNum + hashSeedString('memory') + index * 71,
  }));
}

// ── Creation: recipes/movies/books, per-source bucketed ───────────
type CreationSource = 'recipe' | 'movie' | 'book';
const CREATION_BUCKET_SIZE: Record<CreationSource, number> = { recipe: 3, movie: 15, book: 3 };
const MAX_CREATION_BUCKETS_PER_SOURCE = 4;

function creationSourceEvents(
  seedNum: number,
  daysTogether: number,
  source: CreationSource,
  items: readonly DatedItem[],
): GrowthEvent[] {
  const buckets = bucketByFixedSize(items, CREATION_BUCKET_SIZE[source]).slice(-MAX_CREATION_BUCKETS_PER_SOURCE);
  return buckets.map(({ index, repDate }) => ({
    key: `creation-${source}-bucket-${index}`,
    kind: 'creation' as const,
    domain: 'creation' as const,
    // Джерело-специфічний тон (теплий/фільмовий/гранований) читає рендерер
    // із label — ArtifactNode лишається generic, це вже інтерпретація Crystal.
    label: source,
    birthDay: daysSinceStart(daysTogether, repDate),
    maturityHalfLife: 16,
    growthRange: [0.4, 0.7] as const,
    massRange: [0.07, 0.11] as const,
    breatheSpeedRange: [0.4, 0.65] as const,
    maxMutationRad: 0.65,
    seed: seedNum + hashSeedString(`creation:${source}`) + index * 83,
  }));
}

function creationEvents(
  seedNum: number,
  daysTogether: number,
  recipes: readonly DatedItem[],
  movies: readonly DatedItem[],
  books: readonly DatedItem[],
): GrowthEvent[] {
  return [
    ...creationSourceEvents(seedNum, daysTogether, 'recipe', recipes),
    ...creationSourceEvents(seedNum, daysTogether, 'movie', movies),
    ...creationSourceEvents(seedNum, daysTogether, 'book', books),
  ];
}

// ── Future: wish — виконані бажання = маленькі супутні кристалики ─
const MAX_WISH_BRANCHES = 14;

function wishEvents(seedNum: number, daysTogether: number, wishes: readonly CrystalWish[]): GrowthEvent[] {
  const sliced = wishes.slice(0, MAX_WISH_BRANCHES);
  return sliced.map((w) => ({
    key: `wish-${w.id}`,
    kind: 'wish' as const,
    domain: 'future' as const,
    birthDay: daysSinceStart(daysTogether, w.fulfilledAt),
    maturityHalfLife: 10, // маленька подія — дозріває швидко
    growthRange: [0.3, 0.55] as const,
    massRange: [0.05, 0.08] as const,
    breatheSpeedRange: [0.5, 0.8] as const,
    maxMutationRad: 0.7,
    seed: seedNum + 3311 + w.id * 53,
  }));
}

// ── «Жоден домен ніколи повністю не мовчить» — амбіентний трикл ──
const BASELINE_INTERVAL_DAYS = 260;
const MAX_BASELINE_PER_DOMAIN = 3;
const BASELINE_KIND: Record<GrowthDomainId, NodeKind> = {
  exploration: 'city',
  memory: 'memory',
  connection: 'anniversary',
  creation: 'creation',
  future: 'wish',
};

function baselineEvents(seedNum: number, domain: GrowthDomainId, daysTogether: number): GrowthEvent[] {
  if (daysTogether <= 0) return [];
  const count = Math.min(MAX_BASELINE_PER_DOMAIN, Math.floor(daysTogether / BASELINE_INTERVAL_DAYS) + 1);
  return Array.from({ length: count }, (_, i) => ({
    key: `baseline-${domain}-${i}`,
    kind: BASELINE_KIND[domain],
    domain,
    birthDay: i * BASELINE_INTERVAL_DAYS,
    maturityHalfLife: 45,
    growthRange: [0.16, 0.28] as const,
    massRange: [0.06, 0.1] as const,
    breatheSpeedRange: [0.4, 0.6] as const,
    maxMutationRad: 0.55,
    seed: seedNum + hashSeedString(`baseline:${domain}`) + i * 61,
  }));
}

// ── Крок 2: розв'язання дерева — origin/dir/spin/maturity кожного вузла ──

/** Насіннєва (коренева) точка — низько, ближче до дна композиції; звідти
 *  все дерево росте вгору/назовні. Немає більше видимої опори під нею
 *  (§4 левітації) — це просто математичний початок координат росту. */
const SEED_ORIGIN: Vec3 = [0, -0.34, 0];
/** Початковий полярний кут (від вертикалі) НАСІННЄВОГО напрямку — майже
 *  прямовисно вгору, з ледь помітним нахилом для органічності. */
const SEED_POLAR = 0.12;

const RECENT_POOL = 12;
const SAME_DOMAIN_PROB = 0.7;

/** «Стінки геоди» — реальний друз росте всередині обмеженої порожнини, не
 *  безмежно; м'яке проєктування точки прикріплення назад на цю сферу
 *  навколо насіннєвої точки, коли ланцюжок (за багато поколінь/років
 *  стосунків) відніс би її далі. Не чіпає growthScale/напрямок самого
 *  вузла — лише те, ЗВІДКИ він росте, тож вістря все одно може ледь
 *  «проколоти» межу, як і личить кристалу, що впирається у стінку каверни. */
const MAX_RADIUS_FROM_SEED = 1.6;

/**
 * Обирає батька для нового вузла з «пулу недавніх» уже розв'язаних вузлів:
 * перевага (а) тому самому домену, коли є з чого вибрати, і (б) НЕДАВНІМ —
 * не рівномірно випадковим — вузлам усередині обраного пулу. Саме ця
 * недавня упередженість і дає природні скупчення («3-4 branches grow close
 * together»), а не рівномірний розподіл по всьому артефакту.
 */
function pickParentIndex(
  rng: () => number,
  resolved: readonly ArtifactNode[],
  domain: GrowthDomainId | null,
  skewPower: number,
): number {
  const n = resolved.length;
  const poolStart = Math.max(0, n - RECENT_POOL);
  const sameDomain: number[] = [];
  for (let i = poolStart; i < n; i++) {
    if (resolved[i]!.domain === domain) sameDomain.push(i);
  }

  const useSameDomain = sameDomain.length > 0 && rng() < SAME_DOMAIN_PROB;
  const pool: number[] = useSameDomain
    ? sameDomain
    : Array.from({ length: n - poolStart }, (_, k) => poolStart + k);

  // skew ближче до 0 частіше (при skewPower>1) → offsetFromEnd мале →
  // обраний індекс близький до КІНЦЯ пулу (найновіший).
  const skew = Math.pow(rng(), skewPower);
  const offsetFromEnd = Math.floor(skew * pool.length);
  const poolIdx = Math.max(0, pool.length - 1 - offsetFromEnd);
  return pool[poolIdx]!;
}

/**
 * Розв'язує ОДНЕ дерево росту з відсортованого за віком списку подій:
 * перша подія — насіннєва (parent=null), кожна наступна виростає з
 * поверхні вибраного старшого вузла, успадковуючи його напрямок із малою
 * мутацією. `pressures.stability` глушить мутацію (стабільніші стосунки →
 * рівніший ріст); `pressures.harmony` керує «ступенем ланцюжка» вибору
 * батька (вища гармонія → рівномірніше по пулу, розлогіший кущ; нижча →
 * сильна упередженість до найновішого, тонший ланцюжок).
 */
function resolveGrowthTree(
  daysTogether: number,
  dna: ArtifactDNA,
  events: readonly GrowthEvent[],
  pressures: EvolutionPressures,
): ArtifactNode[] {
  const sorted = [...events].sort((a, b) => a.birthDay - b.birthDay || a.key.localeCompare(b.key));
  const skewPower = 2.2 - pressures.harmony * 1.2;
  const resolved: ArtifactNode[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const rng = mulberry32(ev.seed);

    let origin: Vec3;
    let dir: Vec3;
    let parentKey: string | null;

    if (i === 0) {
      origin = SEED_ORIGIN;
      const seedAzimuth = dna.attractorDirections[0] ?? 0;
      dir = sphericalToVec3(seedAzimuth, SEED_POLAR);
      parentKey = null;
    } else {
      const parentIdx = pickParentIndex(rng, resolved, ev.domain, skewPower);
      const parent = resolved[parentIdx]!;
      parentKey = parent.key;
      const parentDir: Vec3 = [parent.dirX, parent.dirY, parent.dirZ];
      const parentOrigin: Vec3 = [parent.originX, parent.originY, parent.originZ];

      const attachT = 0.2 + rng() * 0.45; // де вздовж батька (0=основа,1=вістря)
      const perp = randomPerpendicular(rng, parentDir);
      // 10-60% товщини батька — бічний зсув, що ГАРАНТУЄ візуальне
      // перекриття/embedding основи дочірньої гілки в батьківську поверхню.
      const embedMag = parent.massScale * (0.1 + rng() * 0.5);

      const rawOrigin = addVec(
        addVec(parentOrigin, scaleVec(parentDir, parent.growthScale * attachT)),
        scaleVec(perp, embedMag),
      );
      const fromSeed = subtractVec(rawOrigin, SEED_ORIGIN);
      const distFromSeed = length(fromSeed);
      origin =
        distFromSeed > MAX_RADIUS_FROM_SEED
          ? addVec(SEED_ORIGIN, scaleVec(fromSeed, MAX_RADIUS_FROM_SEED / distFromSeed))
          : rawOrigin;

      const mutation = Math.max(0.06, ev.maxMutationRad * (1 - pressures.stability * 0.35));
      dir = randomConePerturbation(rng, parentDir, mutation);
    }

    const growthScale = ev.growthRange[0] + rng() * (ev.growthRange[1] - ev.growthRange[0]);
    const massScale = ev.massRange[0] + rng() * (ev.massRange[1] - ev.massRange[0]);
    const breatheSpeed = ev.breatheSpeedRange[0] + rng() * (ev.breatheSpeedRange[1] - ev.breatheSpeedRange[0]);
    const spin = rng() * Math.PI * 2;
    const breathePhase = rng() * Math.PI * 2;
    // Вік = «зараз» мінус момент народження на спільній осі часу — той
    // самий maturityCurve(daysBetween(...)) механізм, що й раніше, лише
    // birthDay тепер спільний для core-тиків і реальних дат одночасно.
    const ageDays = daysTogether - ev.birthDay;

    resolved.push({
      key: ev.key,
      kind: ev.kind,
      domain: ev.domain,
      parentKey,
      ...(ev.label !== undefined ? { label: ev.label } : {}),
      growthScale,
      massScale,
      originX: origin[0],
      originY: origin[1],
      originZ: origin[2],
      dirX: dir[0],
      dirY: dir[1],
      dirZ: dir[2],
      spin,
      maturity: maturityCurve(ageDays, ev.maturityHalfLife),
      breathePhase,
      breatheSpeed,
      ...(ev.emphasized !== undefined ? { emphasized: ev.emphasized } : {}),
    });
  }

  return resolved;
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

/** Будує весь список вузлів артефакту — ОДНЕ ієрархічне дерево. pressures
 *  обчислюється окремо (computeEvolutionPressures) і передається сюди —
 *  та сама структура споживається й deriveClusterMaterial. */
export function buildArtifactNodes(input: ArtifactInput, pressures: EvolutionPressures): ArtifactNode[] {
  const { seedNum, dna, usage } = input;
  const daysTogether = usage.daysTogether;

  const events: GrowthEvent[] = [
    ...coreEvents(seedNum, daysTogether),
    ...placeEvents(seedNum, daysTogether, input.countries, 'country'),
    ...placeEvents(seedNum, daysTogether, input.cities, 'city'),
    ...milestoneEvents(seedNum, daysTogether, input.milestones),
    ...connectionExtraEvents(seedNum, daysTogether, input.achievedGoals, input.anniversaries),
    ...memoryEvents(seedNum, daysTogether, input.memories),
    ...creationEvents(seedNum, daysTogether, input.recipes, input.movies, input.books),
    ...wishEvents(seedNum, daysTogether, input.wishes),
    ...DOMAIN_IDS.flatMap((d) => baselineEvents(seedNum, d, daysTogether)),
  ];

  const nodes = resolveGrowthTree(daysTogether, dna, events, pressures);

  // «Цілі/річниці/тривалість стосунків → Stability»: товщає ВСЕ, постфактум —
  // одна точка застосування замість дублювання в кожному білдері.
  for (const node of nodes) node.massScale *= 1 + pressures.stability * 0.15;

  return nodes;
}
