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

/** 5 тематичних Growth Domains (Artifact Engine — Technical Addendum v2). */
export type GrowthDomainId = 'exploration' | 'memory' | 'connection' | 'creation' | 'future';

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
 * рендерером (crystal3d/). Описує РІСТ (звідки, куди, скільки), а не
 * Lathe-мешевий профіль — рендерер сам вирішує, як це намалювати.
 * ------------------------------------------------------------
 * Ієрархічна модель (заміна попередньої «віяло з одного спільного
 * кореня»): кожна гілка (крім самої першої, насіннєвої) виростає З
 * ПОВЕРХНІ конкретного старшого вузла — `parentKey` — і успадковує його
 * напрямок росту з малою мутацією, а не отримує незалежний випадковий
 * кут. Це і дає «один безперервно еволюціонуючий організм», а не набір
 * приліплених один до одного мешів: точка появи (origin) та напрямок
 * (dir) виводяться з РЕАЛЬНОЇ геометрії батька (artifactNodes.ts::
 * resolveGrowthTree), а не зі спільної точки world-простору.
 */
export interface ArtifactNode {
  /** Стабільна ідентичність — керує useClusterGrowthFlash, семантика незмінна. */
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  /** Ключ вузла, з чиєї поверхні виріс цей — null лише для НАЙПЕРШОГО
   *  (насіннєвого) вузла всього артефакту. */
  parentKey: string | null;
  label?: string;
  /** Поздовжній вимір, до масштабування maturity. */
  growthScale: number;
  /** Товщина, до масштабування maturity. */
  massScale: number;
  /** Світова точка основи/прикріплення (де гілка виходить із батька, або
   *  насіннєва точка для кореневого вузла). */
  originX: number;
  originY: number;
  originZ: number;
  /** Світовий напрямок росту (одиничний вектор) — успадкований від
   *  батька з малою мутацією (див. коментар вище), а не незалежний кут. */
  dirX: number;
  dirY: number;
  dirZ: number;
  /** Оберт навколо власної осі росту. */
  spin: number;
  /** 0 (щойно з'явився) .. ~1 (давно росте) — див. maturityCurve(). */
  maturity: number;
  breathePhase: number;
  breatheSpeed: number;
  /** true для milestone-вузлів — золоте світіння в рендерері. */
  emphasized?: boolean;
}

/** ДНК — генерується ОДИН раз із seed-рядка, ніколи з живих даних. Незмінна назавжди. */
export interface ArtifactDNA {
  seedNum: number;
  /** 3-5 фіксованих азимутів — куди тяжіє НАСІННЄВИЙ (перший, кореневий)
   *  напрямок росту цієї пари. Усі подальші вузли успадковують напрямок
   *  від свого батька (artifactNodes.ts::resolveGrowthTree), тож це більше
   *  не «per-slot» кути для кожної гілки окремо — лише одна точка старту. */
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
  /** Фіксована seeded-перестановка 5 доменів. Раніше призначала кожному
   *  домену жорсткий кутовий клин (тверда просторова ізоляція); ієрархічна
   *  модель росту навмисно прибрала цю жорстку стіну — реальні кристали
   *  зростаються, домени більше не мають гарантованого «свого» сектора.
   *  Поле лишається (детерміноване, нешкідливе) як зарезервований
   *  candidate для майбутнього м'якого напрямкового зміщення. */
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
