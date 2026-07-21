// ============================================================
// artifactTypes — типи «Artifact Engine»: чисто дані, без THREE/React.
// ------------------------------------------------------------
// Ця межа навмисна: жоден файл у artifact/ не імпортує 'three' чи React —
// саме це робить рушій «renderer-agnostic» буквально, а не на словах.
// Сьогодні єдиний споживач — crystal3d/ (кристал), але контракт тут не
// прив'язаний до Lathe-геометрії/Euler-кутів — той переклад робить
// crystal3d/crystalCluster.ts::deriveClusterBranch.
// ============================================================
import type { CrystalDNA, CrystalPlace, MilestoneEvent, CrystalWish } from '../useCrystal';
import type { Vec3 } from './vec3';

/** 5 тематичних Growth Domains (Artifact Engine — Technical Addendum v2). */
export type GrowthDomainId = 'exploration' | 'memory' | 'connection' | 'creation' | 'future';

/** Стадія життєвого циклу кристала: нуклеація → ріст → конкуренція →
 *  полірування → стабілізація. Похідна від зрілості/енергії/тисків,
 *  жодного окремого збереженого стану. */
export type LifeCycleStage = 'nucleation' | 'growth' | 'competition' | 'polishing' | 'stabilization';

/** Роль у колонії нуклеації: домінантний кристал або 2-5 його супутників,
 *  що ділять майже ту саму точку зародження (кварцова друза). */
export type ColonyRole = 'dominant' | 'satellite';

/**
 * Датований первинний факт із БД — «сировина» для доменних білдерів
 * (goal, anniversary, creation-джерела). Той самий принцип, що вже є в
 * CrystalPlace/MilestoneEvent/CrystalWish: береться РЕАЛЬНА дата, вік
 * гілки рахується від неї, а не від якогось окремого «стану еволюції».
 */
export interface DatedItem {
  id: number;
  date: string;
}

export type NodeKind =
  | 'core'
  | 'country'
  | 'city'
  | 'milestone'
  | 'goal'
  | 'anniversary'
  | 'creation'
  | 'memory'
  | 'wish';

/**
 * Абстрактний вузол еволюції — контракт між рушієм (artifact/) і
 * рендерером (crystal3d/). Описує ВІДКЛАДЕННЯ МІНЕРАЛУ (де на тілі маси
 * нуклеювало, куди росте, скільки дозріло), а не Lathe-мешевий профіль —
 * рендерер сам вирішує, як це намалювати.
 */
export interface ArtifactNode {
  /** Стабільна ідентичність — керує useClusterGrowthFlash, семантика незмінна. */
  key: string;
  kind: NodeKind;
  /** null лише для 'core' — стрижневі відкладення існують поза системою доменів. */
  domain: GrowthDomainId | null;
  label?: string;
  /** Поздовжній вимір, до масштабування maturity. */
  growthScale: number;
  /** Товщина, до масштабування maturity. */
  massScale: number;
  /** Точка основи в просторі рушія — лежить трохи ПІД поверхнею свого
   *  субстрату (base burial): основи ховаються одна в одній, тож око бачить
   *  одну мінеральну масу, а не окремі мешi. */
  anchor: Vec3;
  /** Одиничний напрямок росту — успадкований від локальної нормалі поверхні
   *  субстрату (direction inheritance → кристалічні родини). */
  direction: Vec3;
  /** Оберт навколо власної осі. */
  spin: number;
  /** 0 (щойно з'явився) .. ~1 (давно росте) — див. maturityCurve(). */
  maturity: number;
  breathePhase: number;
  breatheSpeed: number;
  /** 0..1 після конкуренції (Growth Shadow): затінені великими сусідами
   *  кристали коротші/тонші/тьмяніші. */
  growthEnergy: number;
  role: ColonyRole;
  stage: LifeCycleStage;
  /** true для milestone-вузлів — золоте світіння в рендерері. */
  emphasized?: boolean;
}

/**
 * Growth Site — кандидат на місце наступного відкладення: точка на бічній
 * поверхні вже існуючого тіла мінеральної маси + аналітична нормаль.
 * score = Pressure × GrowthPotential × SurfaceStress × LocalDensity × Shadow.
 */
export interface GrowthSite {
  point: Vec3;
  normal: Vec3;
  substrateKey: string;
  substrateDirection: Vec3;
  score: number;
}

/**
 * Внутрішній запис симуляції — одне тіло мінеральної маси. Скелетні
 * (повні) розміри керують вибором майбутніх місць росту; renderedAnchor —
 * фактична точка основи на сьогодні (див. growthSurface.ts про дві
 * геометрії).
 */
export interface DepositedCrystal {
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  label?: string;
  /** Скелетна основа (повні розміри субстратного ланцюга). */
  anchor: Vec3;
  /** Основа з урахуванням поточної зрілості субстратного ланцюга. */
  renderedAnchor: Vec3;
  direction: Vec3;
  /** Повна («доросла») довжина/радіус — до масштабування maturity. */
  length: number;
  radius: number;
  maturity: number;
  /** Вік у днях — керує і зрілістю, і видимістю як субстрату (гейтинг за
   *  віком: молодший за подію субстрат для неї не існує). */
  ageDays: number;
  growthEnergy: number;
  colonyId: string;
  role: ColonyRole;
  emphasized?: boolean;
  breathePhase: number;
  breatheSpeed: number;
  spin: number;
}

/**
 * Подія відкладення мінералу — «сировина» симуляції, ЩО і КОЛИ має
 * відкластися (з реальних дат БД). ДЕ — вирішує рулетка ймовірнісного
 * поля в mineralDeposition.ts, ніколи сама подія.
 */
export interface DepositionEvent {
  /** Байт-в-байт ті самі ключі, що й раніше ('core-3', 'milestone-7',
   *  'memory-bucket-2'…) — localStorage amore:clusterSeenKeys лишається валідним. */
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  label?: string;
  /** Вік у днях від реальної дати БД (клемплений ≥0) — зрілість і гейтинг
   *  субстрату; різниці віків стабільні між днями. */
  ageDays: number;
  maturityHalfLife: number;
  /** Точне існуюче значення з реєстру seed-офсетів (+5100+i·173 тощо). */
  seedOffset: number;
  lengthMin: number;
  lengthRange: number;
  radiusMin: number;
  radiusRange: number;
  breatheMin: number;
  breatheRange: number;
  emphasized?: boolean;
}

/** ДНК — генерується ОДИН раз із seed-рядка, ніколи з живих даних. Незмінна назавжди. */
export interface ArtifactDNA {
  seedNum: number;
  /** 3-5 фіксованих азимутів, куди тяжіє ріст саме цієї пари (лише для 'core'). */
  attractorDirections: number[];
  /** 0..1 базовий шанс візуального «мутанта» (stretch-фіча). */
  mutationProbability: number;
  /** 0..1, зарезервовано. */
  asymmetryBias: number;
  /** 0..1, зарезервовано. */
  compactnessBias: number;
  /** 0-360deg — сигнал «виду»: обертає базову палітру кожного kind (крім milestone-золота). */
  hueRotation: number;
  /** 0..1, навмисно інертний плейсхолдер на майбутнє. */
  hiddenPotential: number;
  /** Фіксована seeded-перестановка 5 доменів — раз і назавжди призначає кожному
   *  його (рівний за розміром) кутовий клин. */
  domainOrder: GrowthDomainId[];
}

export type DominantSystem = GrowthDomainId | null;

/** Тиски еволюції — єдиний канал впливу модулів на артефакт (вони НІКОЛИ не чіпають геометрію напряму). */
export interface EvolutionPressures {
  /** Подорожі → Expansion Pressure. */
  expansion: number;
  /** Фото → Refinement Pressure (полірування/прозорість). */
  refinement: number;
  /** Спогади → Luminosity Pressure (світіння). */
  luminosity: number;
  /** Рецепти → Warmth Pressure. */
  warmth: number;
  /** Цілі/річниці/тривалість стосунків → Stability Pressure. */
  stability: number;
  /** Рівномірність використання модулів → Harmony Pressure. */
  harmony: number;
  /** Фільми — залишається як є, не піднято до named-pressure. */
  movieMix: number;
  /** Книги — залишається як є, не піднято до named-pressure. */
  surfaceComplexity: number;
  /** Фінанси → щільність/маса (як і в v1). */
  density: number;
  dominant: DominantSystem;
  dominance: number;
  /** 0..1 «багатство» кожного домену — read-only для доменних білдерів
   *  («конкуренція за простір» без зміни розміру клину). */
  domainShare: Record<GrowthDomainId, number>;
}

/** Вхід рушія — усе, з чого детерміновано будується весь артефакт. */
export interface ArtifactInput {
  seedNum: number;
  dna: ArtifactDNA;
  /** Живий агрегат використання (CrystalDNA з useCrystal.ts) — НЕ те саме, що ArtifactDNA. */
  usage: CrystalDNA;
  countries: readonly CrystalPlace[];
  cities: readonly CrystalPlace[];
  milestones: readonly MilestoneEvent[];
  wishes: readonly CrystalWish[];
  achievedGoals: readonly DatedItem[];
  anniversaries: readonly DatedItem[];
  recipes: readonly DatedItem[];
  movies: readonly DatedItem[];
  books: readonly DatedItem[];
  /** Спогади (photo_calendar) — рахунок для Luminosity Pressure; самі вузли — через bucketByFixedSize. */
  memoriesCount: number;
  memories: readonly DatedItem[];
}
