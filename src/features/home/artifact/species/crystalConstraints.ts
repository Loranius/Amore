// ============================================================
// crystalConstraints — природні правила виду «кристал» (Volume II, §10)
// ЯК ФУНКЦІЯ ІСТОРІЇ ПАРИ, а не як таблиця сталих.
// ------------------------------------------------------------
// Нормативно: docs/02_VOLUMES/VOLUME_II_SPECIES_LAYER.md §10-11,
// docs/01_CONTRACTS/DETERMINISM_STANDARD.md §3.
//
// ЧОМУ ЦЕЙ ФАЙЛ ІСНУЄ. До нього констрейнти були одним замороженим
// об'єктом, підігнаним під конкретний референс (`crystalsofx_viii.glb`).
// Референс був НАВЧАЛЬНИМ МАТЕРІАЛОМ — він показав, чим друза
// відрізняється від пучка конусів, — але як ціль він робив рушій
// декоративним: кристал будь-якої пари виходив однаковий, бо форму задавав
// не їхній досвід, а числа, зняті з чужої моделі.
//
// Тепер референсні числа — це БАЗОВА ЛІНІЯ (`CRYSTAL_BASELINE`): форма
// друзи пари, яка ще нічого не прожила. Кожен прожитий факт зсуває правило
// від цієї лінії. Пара, що багато подорожує, дістає інший закон росту, ніж
// пара, що збирає спогади вдома.
//
// ── ГОЛОВНЕ ОБМЕЖЕННЯ: КОНСТРЕЙНТИ ІСТОРИЧНІ ────────────────────
// Якби правила читались зі «стану на сьогодні», то кожен новий запис у БД
// перераховував би розмір і нахил КОЖНОГО вже наявного тіла — кристал пари
// перебудовувався б щоразу, коли вони щось додають. Це прямо суперечить
// append-only (deposition.test.ts: «нові дані сьогоднішньою датою не
// зрушують жоден існуючий кристал»).
//
// Тому тут та сама механіка, що вже тримає розміщення (growthField.ts::
// placementFieldAt): правило обчислюється на ВІК ПОДІЇ через
// `historyAt(timeline, ageDays)`. Тіло, відкладене два роки тому, назавжди
// росте за законом, який діяв два роки тому; сьогоднішні дані змінюють лише
// те, що відкладається сьогодні. Запис заднім числом переоцінює молодші за
// нього шари — той самий задокументований компроміс, що й у полі розміщення.
//
// ── ЧОГО ТУТ НЕМАЄ І ЧОМУ ───────────────────────────────────────
// Драйвери беруться ЛИШЕ з датованих фактів. `totalSaved` —недатований
// агрегат: `historyAt` віддає його сьогоднішнє значення на будь-який вік.
// Пустити такий факт у констрейнти означало б зламати append-only (один
// новий запис зрушив би всю масу), тож фінанси лишаються там, де були: у
// матеріалі (щільність/маса).
//
// Фото пройшли цей шлях до кінця: Supabase Storage і так віддає
// `created_at`, тож вони тепер датовані (`useHome.ts::usePhotoPool` →
// `ArtifactInput.photos`). Але правила читають не `counts.photos`, а
// `counts.photosDated` — рівно те, чий вік справді відомий. У пари, чиї
// фото прийшли без дат, драйвер лишається 0, і форма не поїде.
// ============================================================
import type { NodeKind } from '../artifactTypes';
import {
  categoryShares,
  evenness,
  historyAt,
  type EvolutionHistoryCounts,
  type EvolutionTimeline,
} from '../evolution';

/** Природні правила кристала (§10) числами — читає Growth Engine. */
export interface CrystalConstraints {
  /** Нуклеація лише біля основи субстрату (частка довжини тіла). */
  siteTMin: number;
  siteTMax: number;
  /** Глибина поховання основи у власних радіусах — основи вростають. */
  burial: number;
  /** Кристал не росте вниз: мінімальна вертикаль напрямку (± рідкісні діагоналі). */
  minUpwardMain: number;
  minUpwardRare: number;
  diagonalChance: number;
  /** Колонії нуклеації (морфологія «друза»). */
  coloniesEnabled: boolean;
  colonyChance: Readonly<Record<NodeKind, number>>;
  colonyShareBoost: number;
  colonyMaxChance: number;
  /** Головний кристал: рівномірний ріст із днями разом і стеля для решти. */
  monarch: {
    baseLength: number;
    lengthGain: number;
    growthDays: number;
    radiusBoost: number;
    heightCeiling: number;
  };
  /** Профіль кургану: висоти спадають від осі. */
  moundFalloff: (horiz: number) => number;
  /** «Гравітаційна компакція»: високо нуклейовані тіла стриманіші. */
  heightDamp: (anchorY: number) => number;
  /** Правдоподібні кварцові пропорції: стеля стрункості (довжина/радіус). */
  slenderness: number;
  monarchSlenderness: number;
  // ── Attachment-safe placement (`CAI-REQ-001..003`) ──────────────
  /** Частка радіуса, якою тіло «резервує» об'єм у перевірці зіткнень.
   *  <1, бо тіло звужується до вістря — повний радіус був би надто суворим. */
  clearanceScale: number;
  /** Мін. кут між основами двох дітей ОДНОГО господаря, радіани
   *  (проти злипання; спека вимагає non-clumping без жорсткої симетрії). */
  minAngularSeparation: number;
  /** Коефіцієнт «стискання» дитини, коли жоден кандидат не проходить
   *  кліренс (спека: reject → redirect → SHRINK → defer). */
  conflictShrink: number;
}

/**
 * Драйвери форми — нормалізовані 0..1 проєкції ДАТОВАНОЇ історії пари.
 * Кожен відповідає одному зрозумілому власникові реченню; саме вони, а не
 * сирі рахунки, входять у формули нижче — щоб зміна шкали одного факту не
 * розповзалась по десятку місць.
 */
export interface CrystalShapeDrivers {
  /** Мітки на карті (країни важать утричі) — «пара багато бачила». */
  travel: number;
  /** Цілі + річниці + прожиті разом дні — «зв'язок міцний». */
  bond: number;
  /** Спогади — «історія густа». */
  memory: number;
  /** Рівномірність доменів — «жили різнобічно, без перекосу». */
  balance: number;
  /** Виконані бажання — «спідниця друзи». */
  wishes: number;
  /** Віхи — «великі події народжують великі гілки». */
  events: number;
  /** Завантажені фото (ЛИШЕ датовані) — «шпилі тягнуться вище». */
  photos: number;
}

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
/** Лінійний зсув правила від базової лінії; t уже нормалізований драйвер. */
const shift = (base: number, amount: number, t: number): number => base + amount * clamp01(t);

/** Шкали нормування навмисно однакові з тими, що вже живуть у
 *  placementFieldAt/computeEvolutionPressures — один факт не може означати
 *  «багато» для розміщення і «мало» для форми. */
export function crystalShapeDrivers(c: EvolutionHistoryCounts): CrystalShapeDrivers {
  const shares = categoryShares(c);
  return {
    travel: clamp01((c.countries * 3 + c.cities) / 28),
    bond: clamp01(
      (c.goals / 8) * 0.5 +
        (Math.min(c.anniversaries, 4) / 4) * 0.3 +
        (Math.min(c.daysTogetherThen, 1000) / 1000) * 0.2,
    ),
    memory: clamp01(c.memories / 20),
    balance: evenness([shares.exploration, shares.memory, shares.connection, shares.creation, shares.future]),
    wishes: clamp01(c.wishes / 10),
    events: clamp01(c.milestones / 8),
    // Та сама шкала 120, що в Refinement Pressure — один факт не може
    // означати «багато фото» для матеріалу і «мало» для форми.
    photos: clamp01(c.photosDated / 120),
  };
}

/** Базові шанси колонії за видом події (морфологія друзи, §9). */
const COLONY_BASE: Readonly<Record<NodeKind, number>> = {
  core: 0.08,
  country: 0.22,
  city: 0.18,
  milestone: 0.25,
  goal: 0.12,
  anniversary: 0.12,
  creation: 0.12,
  memory: 0.12,
  wish: 0.1,
};

/** Дрібні тіла «спідниці» — саме їх множать виконані бажання. Великі
 *  (core/country/city/milestone) ростуть від віх: вони дають ПОМІТНІ гілки. */
const SKIRT_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>(['goal', 'anniversary', 'creation', 'memory', 'wish']);

function colonyChanceFor(d: CrystalShapeDrivers): Record<NodeKind, number> {
  const out = {} as Record<NodeKind, number>;
  for (const kind of Object.keys(COLONY_BASE) as NodeKind[]) {
    const boost = SKIRT_KINDS.has(kind) ? 0.9 * d.wishes : 0.6 * d.events;
    out[kind] = COLONY_BASE[kind] * (1 + boost);
  }
  return out;
}

/**
 * Правила виду для конкретного стану історії.
 *
 * Кожен коефіцієнт читається як речення власника:
 *
 * | драйвер   | що змінює                              | видимий наслідок              |
 * |-----------|----------------------------------------|-------------------------------|
 * | travel    | siteTMax                               | друза підіймається по королю  |
 * | bond      | burial, minUpward, heightCeiling        | пряміша маса, виразніший король|
 * | memory    | slenderness                            | тонші, голчастіші шпилі       |
 * | balance   | moundFalloff                           | пологіший курган, менше «шпиля-самітника» |
 * | wishes    | colonyChance(дрібні), minAngularSep    | густіша спідниця з друзок     |
 * | events    | colonyChance(великі)                   | більше дочірніх кристалів     |
 * | photos    | heightCeiling, підлога moundFalloff     | вищі бічні шпилі              |
 *
 * При НУЛЬОВІЙ історії функція повертає рівно `CRYSTAL_BASELINE` — форму
 * друзи, з якої починає кожна пара.
 */
export function crystalConstraintsFrom(d: CrystalShapeDrivers): CrystalConstraints {
  // Пологість кургану — те, що вирішує ВИСОТУ бічних шпилів: множник
  // падає з відстанню від осі, і саме він робив дітей куксами.
  //   • balance: рівномірно прожите життя дає ширший, рівніший курган;
  //     перекошене — різкий спад і один шпиль над рештою;
  //   • photos: підлога множника росте, тобто далекі від осі шпилі
  //     перестають так різко коротшати — «чим більше фото, тим вищі шпилі».
  //     Діє на ПІДЛОГУ, а не на стелю ієрархії (`monarch.heightCeiling`):
  //     та стереже друзу від «качана кукурудзи», і чіпати її означало б
  //     дозволити дітям наздогнати короля.
  const falloffFloor = shift(0.3, 0.1, d.balance) + 0.12 * clamp01(d.photos);
  const falloffRate = shift(4.0, -1.2, d.balance);
  return {
    // Нуклеація ТІЛЬКИ біля підошви. Найважливіше число виду: заміри
    // референсу показали, що 93% тіл кріпляться нижче 35% висоти. Мандри
    // піднімають стелю — маса розповзається й угору теж, — але навіть на
    // максимумі це нижня третина, не «бугорки на боці короля».
    siteTMin: 0.02,
    siteTMax: shift(0.22, 0.08, d.travel),
    // Глибше поховання з міцнішим зв'язком: підошва друзи стає ОДНІЄЮ
    // масою, а не пучком окремих торців.
    burial: shift(0.55, 0.12, d.bond),
    // Друза — ВІЯЛО шпилів. Молода пара дає розкидане віяло; довгий
    // спільний шлях випрямляє масу вгору (менше діагоналей).
    minUpwardMain: shift(0.3, 0.14, d.bond),
    minUpwardRare: 0.12,
    diagonalChance: shift(0.5, -0.14, d.bond),
    coloniesEnabled: true,
    colonyChance: colonyChanceFor(d),
    colonyShareBoost: 0.15,
    colonyMaxChance: shift(0.35, 0.15, d.wishes),
    // Головний кристал росте рівномірно з віком стосунків — це робить
    // `event.ageDays` у growthEngine, не ці числа.
    //
    // `baseLength`, `lengthGain` і `radiusBoost` читаються ЛИШЕ в гілці
    // монарха, а монарх — найстаріша подія в масі, тож його історія завжди
    // порожня (`historyAt(timeline, daysTogether)` дає bond = 0). Робити їх
    // залежними від драйверів було б самообманом: формула виглядала б
    // чутливою, а на екрані не змінювалось би нічого. Тому вони сталі.
    //
    // `heightCeiling` — інша річ: це стеля для ДІТЕЙ відносно короля
    // (`length = min(length, monarch.length × ceiling)`), і читається вона з
    // констрейнтів ДИТИНИ, тобто драйвери тут живі:
    //   • bond опускає стелю — що довший спільний шлях, то виразніше
    //     король домінує над рештою;
    //   • photos піднімають — «чим більше фото, тим вищі шпилі». Це єдиний
    //     важіль, який справді робить бічні шпилі вищими: підлога кургану
    //     сама по собі дає лише +2% (виміряно), бо високі тіла все одно
    //     впираються в цю стелю.
    // Обидва зсуви малі навмисно: стеля — те, що стереже друзу від «качана
    // кукурудзи» (structure.test.ts: король ≥ 2:1).
    monarch: {
      baseLength: 1.35,
      lengthGain: 1.05,
      growthDays: 1200,
      radiusBoost: 0.86,
      heightCeiling: shift(0.4, -0.06, d.bond) + 0.12 * clamp01(d.photos),
    },
    moundFalloff: (horiz) => falloffFloor + (1 - falloffFloor) / (1 + horiz * falloffRate),
    heightDamp: (anchorY) => 1 / (1 + 0.5 * Math.max(0, anchorY + 0.1)),
    // Стрункість: густа історія спогадів витягує шпилі в голки.
    slenderness: shift(9.5, 2.0, d.memory),
    monarchSlenderness: shift(11, 2.0, d.memory),
    clearanceScale: 0.8,
    // Густіша спідниця мусить фізично вміститись: що більше виконаних
    // бажань, то менший мінімальний кут між сусідніми основами.
    minAngularSeparation: shift(0.4, -0.1, d.wishes),
    conflictShrink: 0.62,
  };
}

/** Історія, якої ще немає: пара щойно почала. */
const NO_HISTORY: CrystalShapeDrivers = {
  travel: 0,
  bond: 0,
  memory: 0,
  balance: 0,
  wishes: 0,
  events: 0,
  photos: 0,
};

/**
 * Базова лінія виду — форма друзи до будь-якого прожитого факту.
 * Це і є «природні правила кристала» в чистому вигляді: усе, що нижче,
 * істина для КОЖНОЇ пари (кристал не росте вниз, основи поховані,
 * нуклеація біля підошви, колонії дозволені).
 */
export const CRYSTAL_BASELINE: CrystalConstraints = crystalConstraintsFrom(NO_HISTORY);

/**
 * Правила виду СТАНОМ НА ВІК ПОДІЇ — те, що споживає Growth Engine.
 * Дзеркалить `placementFieldAt`: обидва читають ту саму історію тим самим
 * `historyAt`, тож «де тіло сідає» і «за яким законом воно росте»
 * заморожуються на одну й ту саму дату.
 */
export function crystalConstraintsAt(timeline: EvolutionTimeline, ageDays: number): CrystalConstraints {
  return crystalConstraintsFrom(crystalShapeDrivers(historyAt(timeline, ageDays)));
}
