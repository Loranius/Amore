// ============================================================
// growthEvents — перелічення подій відкладення мінералу з реальних даних.
// ------------------------------------------------------------
// Тут вирішується ЩО і КОЛИ відкладається (ключі, дати, капи, seed-офсети —
// байт-в-байт ті самі, що в попередньому поколінні рушія); ДЕ — вирішує
// ймовірнісне поле в mineralDeposition.ts.
//
// ПОЛІТИКА ВПОРЯДКУВАННЯ (append-only ядро рушія):
// симуляція йде НЕ глобальним сортуванням за датою, а окремими стрімами:
//   • bedrock — core-i + baseline-*-i (породжені самим часом разом),
//     злиті за днем народження; нові елементи з'являються лише в хвості;
//   • по одному стріму на джерело даних (країни, міста, віхи, цілі,
//     річниці, memory-бакети, creation-бакети×3, бажання) — ранжування
//     всередині стріму СТАБІЛЬНЕ (id БД зростає навіть для заднім числом
//     доданих записів; бакети append-only за побудовою bucketByFixedSize).
// Подія стріму S (ранг j, вік A) бачить як субстрат ЛИШЕ:
//   {ядро-нуклеус} ∪ {bedrock не молодший за A} ∪ {кристали S з рангом < j}.
// Наслідок: дані, додані СЬОГОДНІШНЬОЮ датою, НІКОЛИ не зрушують жоден
// існуючий кристал (строгий append-only — там, де раніше жила гарантія
// клинів): і субстрат, і історичне ймовірнісне поле (growthField.ts::
// placementFieldAt) кожної існуючої події заморожені її датою. Обмежений
// перерозподіл існує лише для записів ЗАДНІМ ЧИСЛОМ (напр. старий
// тревел-пін): вони зсувають ранги пізніших подій свого стріму й входять в
// історичне поле всіх молодших за себе подій → молодші шари можуть
// переосісти. Ключі при цьому незмінні (жодного хибного growth flash), а
// геологічно це читається правильно — «зміна минулого переосаджує шари,
// що нашарувались поверх». Шлях розміщення ніколи не читає сьогоднішню
// дату: гейтинг і історія порівнюють ВІКИ (різниці стабільні між днями),
// зрілість масштабує лише рендер.
// ============================================================
import { daysBetween } from '../homeUtils';
import type { CrystalWish } from '../useCrystal';
import type { ArtifactInput, DatedItem, DepositionEvent, GrowthDomainId, NodeKind } from './artifactTypes';
import { hashSeedString } from '../mulberry32';

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
 * багато сирих рядків в одне відкладення» під принципом «ніколи не перебудовувати».
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

export interface DepositionStream {
  id: string;
  events: DepositionEvent[];
}

/** Вік від дати БД, клемплений ≥0 (майбутня дата = «щойно»). */
const age = (date: string): number => Math.max(0, daysBetween(date));

// ── bedrock: core + доменні baseline, породжені часом разом ─────
const CORE_INTERVAL_DAYS = 40;
const MAX_CORE_BRANCHES = 22;
const BASELINE_INTERVAL_DAYS = 260;
// 2 (було 3): амбіентний трикл лишається, але композиція «дихає» — менше
// дрібних тіл, що конкурують за увагу.
const MAX_BASELINE_PER_DOMAIN = 2;

const DOMAIN_IDS: GrowthDomainId[] = ['exploration', 'memory', 'connection', 'creation', 'future'];
const BASELINE_KIND: Record<GrowthDomainId, NodeKind> = {
  exploration: 'city',
  memory: 'memory',
  connection: 'anniversary',
  creation: 'creation',
  future: 'wish',
};

/**
 * Bedrock — «материнська порода»: відкладення, які створює сам час разом
 * (core кожні 40 днів, амбіентний трикл кожного домену кожні 260), злиті
 * за днем народження. Нові елементи з'являються рівно в момент перетину
 * свого дня народження — тобто завжди в хвості злитого порядку.
 */
function buildBedrockStream(daysTogether: number): DepositionStream {
  type Timed = { birthDay: number; event: DepositionEvent };
  const timed: Timed[] = [];

  if (daysTogether > 0) {
    const coreCount = Math.min(MAX_CORE_BRANCHES, Math.floor(daysTogether / CORE_INTERVAL_DAYS) + 1);
    for (let i = 0; i < coreCount; i++) {
      timed.push({
        birthDay: i * CORE_INTERVAL_DAYS,
        event: {
          key: `core-${i}`,
          kind: 'core',
          domain: null,
          ageDays: daysTogether - i * CORE_INTERVAL_DAYS,
          maturityHalfLife: 18,
          seedOffset: 5100 + i * 173,
          lengthMin: 0.75,
          lengthRange: 1.15,
          radiusMin: 0.06,
          radiusRange: 0.07,
          breatheMin: 0.35,
          breatheRange: 0.3,
        },
      });
    }

    for (const domain of DOMAIN_IDS) {
      const count = Math.min(MAX_BASELINE_PER_DOMAIN, Math.floor(daysTogether / BASELINE_INTERVAL_DAYS) + 1);
      for (let i = 0; i < count; i++) {
        timed.push({
          birthDay: i * BASELINE_INTERVAL_DAYS,
          event: {
            key: `baseline-${domain}-${i}`,
            kind: BASELINE_KIND[domain],
            domain,
            ageDays: daysTogether - i * BASELINE_INTERVAL_DAYS,
            maturityHalfLife: 45,
            seedOffset: hashSeedString(`baseline:${domain}`) + i * 61,
            lengthMin: 0.16,
            lengthRange: 0.12,
            radiusMin: 0.06,
            radiusRange: 0.04,
            breatheMin: 0.4,
            breatheRange: 0.2,
          },
        });
      }
    }
  }

  // Стабільне злиття: день народження, tie-break за key (обидва незмінні).
  timed.sort((a, b) => a.birthDay - b.birthDay || a.event.key.localeCompare(b.event.key));
  return { id: 'bedrock', events: timed.map((t) => t.event) };
}

// ── Стріми даних ─────────────────────────────────────────────────

const MAX_COUNTRY_BRANCHES = 6;
const MAX_CITY_BRANCHES = 10;

function buildPlaceStream(
  id: string,
  places: readonly { name: string; firstVisit: string }[],
  kind: 'country' | 'city',
): DepositionStream {
  const cap = kind === 'country' ? MAX_COUNTRY_BRANCHES : MAX_CITY_BRANCHES;
  const [lengthMin, lengthRange] = kind === 'country' ? [1.9, 0.7] : [1.05, 0.5];
  const [radiusMin, radiusRange] = kind === 'country' ? [0.3, 0.12] : [0.16, 0.08];
  // Ранг у стрімі: (перший візит, назва) — у CrystalPlace немає id БД.
  const events = [...places.slice(0, cap)]
    .sort((a, b) => a.firstVisit.localeCompare(b.firstVisit) || a.name.localeCompare(b.name))
    .map((p): DepositionEvent => ({
      key: `${kind}-${p.name}`,
      kind,
      domain: 'exploration',
      label: p.name,
      ageDays: age(p.firstVisit),
      maturityHalfLife: kind === 'country' ? 30 : 22,
      seedOffset: hashSeedString(`${kind}:${p.name}`),
      lengthMin,
      lengthRange,
      radiusMin,
      radiusRange,
      breatheMin: 0.22,
      breatheRange: 0.12,
    }));
  return { id, events };
}

const MAX_MILESTONE_BRANCHES = 6;

function buildMilestoneStream(milestones: ArtifactInput['milestones']): DepositionStream {
  // Членство — ті самі останні 6, що й раніше; ранг — за id БД (serial id
  // зростає навіть для віх, доданих заднім числом → строгий append у хвіст).
  const events = [...milestones.slice(-MAX_MILESTONE_BRANCHES)]
    .sort((a, b) => a.id - b.id)
    .map((m): DepositionEvent => ({
      key: `milestone-${m.id}`,
      kind: 'milestone',
      domain: 'connection',
      label: m.title,
      ageDays: age(m.date),
      maturityHalfLife: 6, // одразу вагомі, лиш трохи «доростають»
      seedOffset: 7789 + m.id * 97,
      lengthMin: 1.2,
      lengthRange: 0.5,
      radiusMin: 0.2,
      radiusRange: 0.06,
      breatheMin: 0.3,
      breatheRange: 0.15,
      emphasized: true,
    }));
  return { id: 'milestones', events };
}

function buildDatedStream(
  id: string,
  kind: 'goal' | 'anniversary',
  items: readonly DatedItem[],
  seedBase: number,
): DepositionStream {
  const events = [...items]
    .sort((a, b) => a.id - b.id)
    .map((item): DepositionEvent => ({
      key: `${kind}-${item.id}`,
      kind,
      domain: 'connection',
      ageDays: age(item.date),
      maturityHalfLife: 20,
      seedOffset: seedBase + item.id * 41,
      lengthMin: 0.55,
      lengthRange: 0.3,
      radiusMin: 0.1,
      radiusRange: 0.05,
      breatheMin: 0.3,
      breatheRange: 0.15,
    }));
  return { id, events };
}

const MEMORY_BUCKET_SIZE = 6;
const MAX_MEMORY_BUCKETS = 8;

function buildMemoryStream(memories: readonly DatedItem[]): DepositionStream {
  const events = bucketByFixedSize(memories, MEMORY_BUCKET_SIZE)
    .slice(-MAX_MEMORY_BUCKETS)
    .map(({ index, repDate }): DepositionEvent => ({
      key: `memory-bucket-${index}`,
      kind: 'memory',
      domain: 'memory',
      ageDays: age(repDate),
      maturityHalfLife: 14,
      seedOffset: hashSeedString('memory') + index * 71,
      lengthMin: 0.4,
      lengthRange: 0.3,
      radiusMin: 0.07,
      radiusRange: 0.04,
      breatheMin: 0.4,
      breatheRange: 0.25,
    }));
  return { id: 'memories', events };
}

type CreationSource = 'recipe' | 'movie' | 'book';
const CREATION_BUCKET_SIZE: Record<CreationSource, number> = { recipe: 3, movie: 15, book: 3 };
const MAX_CREATION_BUCKETS_PER_SOURCE = 4;

function buildCreationStream(source: CreationSource, items: readonly DatedItem[]): DepositionStream {
  const events = bucketByFixedSize(items, CREATION_BUCKET_SIZE[source])
    .slice(-MAX_CREATION_BUCKETS_PER_SOURCE)
    .map(({ index, repDate }): DepositionEvent => ({
      key: `creation-${source}-bucket-${index}`,
      kind: 'creation',
      domain: 'creation',
      // Джерело-специфічний тон (теплий/фільмовий/гранований) читає рендерер
      // із label — ArtifactNode лишається generic.
      label: source,
      ageDays: age(repDate),
      maturityHalfLife: 16,
      seedOffset: hashSeedString(`creation:${source}`) + index * 83,
      lengthMin: 0.4,
      lengthRange: 0.3,
      radiusMin: 0.07,
      radiusRange: 0.04,
      breatheMin: 0.4,
      breatheRange: 0.25,
    }));
  return { id: `creation-${source}`, events };
}

const MAX_WISH_BRANCHES = 14;

function buildWishStream(wishes: readonly CrystalWish[]): DepositionStream {
  const events = [...wishes.slice(0, MAX_WISH_BRANCHES)]
    .sort((a, b) => a.id - b.id)
    .map((w): DepositionEvent => ({
      key: `wish-${w.id}`,
      kind: 'wish',
      domain: 'future',
      ageDays: age(w.fulfilledAt),
      maturityHalfLife: 10, // маленька подія — дозріває швидко
      seedOffset: 3311 + w.id * 53,
      lengthMin: 0.3,
      lengthRange: 0.25,
      radiusMin: 0.05,
      radiusRange: 0.03,
      breatheMin: 0.5,
      breatheRange: 0.3,
    }));
  return { id: 'wishes', events };
}

/**
 * Усі стріми відкладення. Перший — завжди bedrock (стріми даних нуклеюються
 * на ньому); порядок решти не впливає на результат (жоден стрім не читає
 * стан іншого — див. політику вгорі).
 */
export function buildDepositionStreams(input: ArtifactInput): DepositionStream[] {
  return [
    buildBedrockStream(input.usage.daysTogether),
    buildPlaceStream('countries', input.countries, 'country'),
    buildPlaceStream('cities', input.cities, 'city'),
    buildMilestoneStream(input.milestones),
    buildDatedStream('goals', 'goal', input.achievedGoals, 6203),
    buildDatedStream('anniversaries', 'anniversary', input.anniversaries, 8317),
    buildMemoryStream(input.memories),
    buildCreationStream('recipe', input.recipes),
    buildCreationStream('movie', input.movies),
    buildCreationStream('book', input.books),
    buildWishStream(input.wishes),
  ];
}
