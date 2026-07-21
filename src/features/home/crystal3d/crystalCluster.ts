// ============================================================
// crystalCluster — «Crystal Engine v2.0»: справжній мінеральний друз,
// що росте роками, а не набір категорійних слотів (crystalGeometry3d.ts
// v1 — видалено, повністю замінено цим модулем).
// ------------------------------------------------------------
// АРХІТЕКТУРА (навіщо саме так):
//
// 1) Немає персистентного «стану кристала» в БД. Натомість «еволюція» —
//    чиста функція (seed, реальні дати з таблиць, поточний момент часу).
//    Кожна гілка «народжується» у СВІЙ конкретний реальний момент (дата
//    події/першого візиту/тощо) і з того моменту дозріває за детермінованою
//    кривою maturityCurve(). Це дає всі властивості, які просив користувач,
//    БЕЗ додаткової схеми чи фонових задач:
//      - «ніколи не перебудовується» — ідентичність гілки (її key) незмінна;
//      - «існуючі гілки товщають/загострюються» — maturity росте з часом;
//      - «нові гілки з'являються» — нова подія в БД => нова гілка з віком 0;
//      - той самий seed+дані завжди дають той самий кристал (детермінізм).
//
// 2) Гілки, а не «категорійні слоти». Лише системи, що описані в ТЗ як такі,
//    що ростять СТРУКТУРУ (не матеріал), створюють реальні окремі гілки:
//      - 'core'      — сам час разом: постійний базовий приріст кластера
//                      (нова малесенька гілка щоCORE_INTERVAL_DAYS днів
//                      разом) — це і є «кристал живе роками», незалежно
//                      від активності в конкретних модулях;
//      - 'country'    — величезна структурна мутація (Problem: «Countries →
//                      huge structural mutations»);
//      - 'city'       — середня структурна мутація;
//      - 'milestone'  — великі життєві події (заручини/весілля/переїзд) —
//                      головна, золота, світна гілка;
//      - 'wish'       — виконане бажання — маленький бічний кристалик.
//    Фото/фільми/рецепти/книги/спогади/цілі — НЕ гілки, а властивості
//    матеріалу (computeClusterMaterial нижче) — саме так, як просив
//    користувач («Photos → polish, not shape»).
//
// 3) Природна, а не «розставлена вручну» форма: напрямок росту — випадкова
//    точка на конусі навколо вертикалі (не рівномірний віночок по секторах),
//    тісний розкид від основи (гілки можуть перетинатись/затуляти одна
//    одну), і явний нахил аж до майже горизонтального — «not all pointing
//    upward».
// ============================================================
import * as THREE from 'three';
import { mulberry32, hashSeedString } from '../mulberry32';
import { daysBetween } from '../homeUtils';
import type { CrystalDNA, CrystalPlace, MilestoneEvent, CrystalWish } from '../useCrystal';

// ── Дозрівання («еволюція без перебудови») ──────────────────────
/**
 * Асимптотична крива 0→1: свіжовиниклий кристалик (age=0) — тонкий
 * тупий паросток; що більше минуло часу — то товщий/гостріший/
 * стабільніший (age → ∞ ⇒ maturity → 1, ніколи не «завершується»
 * остаточно — завжди трошки ще росте, як і справжній мінерал).
 */
export function maturityCurve(ageDays: number, halfLife = 18): number {
  return 1 - Math.exp(-Math.max(0, ageDays) / halfLife);
}

export type BranchKind = 'core' | 'country' | 'city' | 'milestone' | 'wish';

export interface ClusterBranch {
  key: string;
  kind: BranchKind;
  label?: string;
  /** «Доросла» довжина/товщина (до масштабування maturity в buildBranchGeometry). */
  height: number;
  radiusBottom: number;
  posX: number;
  posZ: number;
  tiltX: number;
  tiltZ: number;
  rotY: number;
  colorA: string;
  colorB: string;
  breathePhase: number;
  breatheSpeed: number;
  /** 0 (щойно з'явилась) .. ~1 (давно росте) — див. maturityCurve(). */
  maturity: number;
  /** Золоте світіння для milestone-гілок. */
  emissive?: boolean;
}

const CORE_COLOR_A = '#6d4fa8';
const CORE_COLOR_B = '#e9ddff';
const COUNTRY_COLOR_A = '#1f8f82';
const COUNTRY_COLOR_B = '#8fe0d6';
const CITY_COLOR_A = '#4a7fc9';
const CITY_COLOR_B = '#b9d8ff';
const MILESTONE_COLOR_A = '#c9971f';
const MILESTONE_COLOR_B = '#fff3c9';
const WISH_COLOR_A = '#e0527a';
const WISH_COLOR_B = '#f6a8c0';

/**
 * Випадковий, але детермінований напрямок нахилу — конус до ~75° від
 * вертикалі. slot/slotCount+symmetry («Цілі → симетрія») тягнуть азимут
 * до рівномірного розташування по колу: symmetry=0 — дикий розкид,
 * symmetry→0.6 (максимум, див. computeClusterMaterial) — впорядкованіший,
 * але ніколи не ідеально механічний віночок.
 */
function randomLean(
  rng: () => number,
  maxTiltRad: number,
  symmetry = 0,
  slot = 0,
  slotCount = 1,
) {
  const rawTheta = rng() * Math.PI * 2;
  const slotTheta = (slot / slotCount) * Math.PI * 2;
  const theta = rawTheta * (1 - symmetry) + slotTheta * symmetry;
  const phi = rng() * maxTiltRad; // 0 = прямо вгору
  return {
    posAngle: theta,
    tiltX: Math.sin(theta) * phi,
    tiltZ: -Math.cos(theta) * phi,
  };
}

// ── 'core' — базовий приріст від самого часу разом ───────────────
const CORE_INTERVAL_DAYS = 40;
const MAX_CORE_BRANCHES = 22;

function buildCoreBranches(seedNum: number, daysTogether: number, symmetry: number): ClusterBranch[] {
  if (daysTogether <= 0) return [];
  const count = Math.min(MAX_CORE_BRANCHES, Math.floor(daysTogether / CORE_INTERVAL_DAYS) + 1);
  const branches: ClusterBranch[] = [];

  for (let i = 0; i < count; i++) {
    const rng = mulberry32(seedNum + 5100 + i * 173);
    const birthDay = i * CORE_INTERVAL_DAYS;
    const maturity = maturityCurve(daysTogether - birthDay);
    const { tiltX, tiltZ, posAngle } = randomLean(rng, 0.95, symmetry, i, count);
    const dist = 0.04 + rng() * 0.2; // тісно скупчені — стовбур кластера, не віночок

    branches.push({
      key: `core-${i}`,
      kind: 'core',
      height: 0.6 + rng() * 1.0,
      radiusBottom: 0.06 + rng() * 0.07,
      posX: Math.cos(posAngle) * dist,
      posZ: Math.sin(posAngle) * dist,
      tiltX,
      tiltZ,
      rotY: rng() * Math.PI * 2,
      colorA: CORE_COLOR_A,
      colorB: CORE_COLOR_B,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.35 + rng() * 0.3,
      maturity,
    });
  }
  return branches;
}

// ── 'country' / 'city' — географія як структурні мутації ─────────
const MAX_COUNTRY_BRANCHES = 6;
const MAX_CITY_BRANCHES = 10;

function buildPlaceBranches(
  seedNum: number,
  places: readonly CrystalPlace[],
  kind: 'country' | 'city',
  symmetry: number,
): ClusterBranch[] {
  const cap = kind === 'country' ? MAX_COUNTRY_BRANCHES : MAX_CITY_BRANCHES;
  const [heightMin, heightRange] = kind === 'country' ? [1.9, 0.7] : [1.05, 0.5];
  const [radiusMin, radiusRange] = kind === 'country' ? [0.3, 0.12] : [0.16, 0.08];
  const distRange: [number, number] = kind === 'country' ? [0.28, 0.18] : [0.4, 0.22];
  const [colorA, colorB] = kind === 'country' ? [COUNTRY_COLOR_A, COUNTRY_COLOR_B] : [CITY_COLOR_A, CITY_COLOR_B];
  const sliced = places.slice(0, cap);

  return sliced.map(({ name, firstVisit }, idx) => {
    const rng = mulberry32(seedNum + hashSeedString(`${kind}:${name}`));
    const maturity = maturityCurve(daysBetween(firstVisit), kind === 'country' ? 30 : 22);
    const { tiltX, tiltZ, posAngle } = randomLean(
      rng,
      kind === 'country' ? 0.55 : 0.75,
      symmetry,
      idx,
      sliced.length,
    );
    const dist = distRange[0] + rng() * distRange[1];

    return {
      key: `${kind}-${name}`,
      kind,
      label: name,
      height: heightMin + rng() * heightRange,
      radiusBottom: radiusMin + rng() * radiusRange,
      posX: Math.cos(posAngle) * dist,
      posZ: Math.sin(posAngle) * dist,
      tiltX,
      tiltZ,
      rotY: rng() * Math.PI * 2,
      colorA,
      colorB,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.22 + rng() * 0.12,
      maturity,
    };
  });
}

// ── 'milestone' — великі життєві події ────────────────────────────
const MAX_MILESTONE_BRANCHES = 6;

function buildMilestoneBranches(
  seedNum: number,
  milestones: readonly MilestoneEvent[],
  symmetry: number,
): ClusterBranch[] {
  const sliced = milestones.slice(-MAX_MILESTONE_BRANCHES);
  return sliced.map((m, idx) => {
    const rng = mulberry32(seedNum + 7789 + m.id * 97);
    const { tiltX, tiltZ, posAngle } = randomLean(rng, 0.5, symmetry, idx, sliced.length);
    const dist = 0.48 + rng() * 0.2;

    return {
      key: `milestone-${m.id}`,
      kind: 'milestone' as const,
      label: m.title,
      height: 1.2 + rng() * 0.5,
      radiusBottom: 0.2 + rng() * 0.06,
      posX: Math.cos(posAngle) * dist,
      posZ: Math.sin(posAngle) * dist,
      tiltX,
      tiltZ,
      rotY: rng() * Math.PI * 2,
      colorA: MILESTONE_COLOR_A,
      colorB: MILESTONE_COLOR_B,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.3 + rng() * 0.15,
      // Великі події ще не «дозрівають» повільно — вони одразу вагомі,
      // лиш трохи «доростають» перші дні після самої дати події.
      maturity: maturityCurve(daysBetween(m.date), 6),
      emissive: true,
    };
  });
}

// ── 'wish' — виконані бажання = маленькі супутні кристалики ──────
const MAX_WISH_BRANCHES = 14;

function buildWishBranches(seedNum: number, wishes: readonly CrystalWish[], symmetry: number): ClusterBranch[] {
  const sliced = wishes.slice(0, MAX_WISH_BRANCHES);
  return sliced.map((w, idx) => {
    const rng = mulberry32(seedNum + 3311 + w.id * 53);
    const { tiltX, tiltZ, posAngle } = randomLean(rng, 0.85, symmetry, idx, sliced.length);
    const dist = 0.35 + rng() * 0.25;

    return {
      key: `wish-${w.id}`,
      kind: 'wish' as const,
      height: 0.3 + rng() * 0.25,
      radiusBottom: 0.05 + rng() * 0.03,
      posX: Math.cos(posAngle) * dist,
      posZ: Math.sin(posAngle) * dist,
      tiltX,
      tiltZ,
      rotY: rng() * Math.PI * 2,
      colorA: WISH_COLOR_A,
      colorB: WISH_COLOR_B,
      breathePhase: rng() * Math.PI * 2,
      breatheSpeed: 0.5 + rng() * 0.3,
      // Бажання дозрівають швидко (за ~10 днів) — це маленька, а не епохальна подія.
      maturity: maturityCurve(daysBetween(w.fulfilledAt), 10),
    };
  });
}

export interface ClusterInput {
  seedNum: number;
  dna: CrystalDNA;
  countries: readonly CrystalPlace[];
  cities: readonly CrystalPlace[];
  milestones: readonly MilestoneEvent[];
  wishes: readonly CrystalWish[];
  /** Спогади (photo_calendar) — «внутрішнє світіння», не форма. */
  memoriesCount: number;
}

/** Порожньо — кристал ще не почав рости (симетрично з isDnaEmpty у v1). */
export function isClusterEmpty(input: ClusterInput): boolean {
  return (
    input.dna.daysTogether <= 0 &&
    input.countries.length === 0 &&
    input.cities.length === 0 &&
    input.milestones.length === 0 &&
    input.wishes.length === 0
  );
}

export function buildClusterBranches(input: ClusterInput): ClusterBranch[] {
  // «Цілі → симетрія»: одне число, що злегка впорядковує кут росту КОЖНОЇ
  // групи гілок (кожна група по колу окремо — країни не тягнуться до кута
  // міст тощо).
  const { symmetry } = computeClusterMaterial(input);
  return [
    ...buildCoreBranches(input.seedNum, input.dna.daysTogether, symmetry),
    ...buildPlaceBranches(input.seedNum, input.countries, 'country', symmetry),
    ...buildPlaceBranches(input.seedNum, input.cities, 'city', symmetry),
    ...buildMilestoneBranches(input.seedNum, input.milestones, symmetry),
    ...buildWishBranches(input.seedNum, input.wishes, symmetry),
  ];
}

// ── Матеріал: фото/фільми/рецепти/книги/спогади/цілі = НЕ форма ──
export type DominantSystem = 'travel' | 'photos' | 'movies' | 'recipes' | 'memories' | 'books' | null;

export interface ClusterMaterial {
  /** Фото → полірування/прозорість. */
  roughness: number;
  clearcoat: number;
  transmission: number;
  /** Рецепти → теплий відтінок (0..1 домішка теплого кольору). */
  warmthMix: number;
  /** Фільми → внутрішні кольорові переливи (0..1 домішка «настроєвого» кольору). */
  movieMix: number;
  /** Спогади → внутрішнє світіння ядра. */
  glow: number;
  /** Книги → складність поверхні (більше/менш регулярні грані). */
  surfaceComplexity: number;
  /** Фінанси → щільність/маса. */
  density: number;
  /** Цілі → симетрія розташування гілок (0 = дикий розкид, 1 = впорядкований). */
  symmetry: number;
  /** Яка активність домінує — саме вона «візуально домінує» в кристалі. */
  dominant: DominantSystem;
  dominance: number;
}

const WARMTH_COLOR = new THREE.Color('#ff8a3d');
const MOVIE_COLOR = new THREE.Color('#4fd1e0');

export function computeClusterMaterial(input: ClusterInput): ClusterMaterial {
  const { dna, countries, cities } = input;
  const photosClamped = Math.min(dna.photos, 120);

  const roughness = Math.max(0.06, 0.32 - photosClamped * 0.0018);
  const clearcoat = Math.min(0.95, 0.55 + photosClamped * 0.003);
  const transmission = Math.min(0.75, 0.3 + photosClamped * 0.003);
  const warmthMix = Math.min(0.6, dna.recipesSaved * 0.05);
  const movieMix = Math.min(0.7, dna.moviesWatched * 0.01);
  const glow = Math.min(0.85, input.memoriesCount * 0.035);
  const surfaceComplexity = Math.min(1, dna.booksRead * 0.08);
  const density = 1 + Math.min(0.3, Math.log10(1 + dna.totalSaved) * 0.045);
  const symmetry = Math.min(0.6, (dna.goalsAchieved / 8) * 0.6);

  // Пропорційне домінування: чия частка активності найбільша — та й «тягне»
  // кристал у свій бік (довші подорожі / більший блиск / тепліший тон тощо).
  const shares: Record<Exclude<DominantSystem, null>, number> = {
    travel: countries.length * 3 + cities.length,
    photos: dna.photos,
    movies: dna.moviesWatched,
    recipes: dna.recipesSaved,
    memories: input.memoriesCount,
    books: dna.booksRead,
  };
  const total = Object.values(shares).reduce((a, b) => a + b, 0) || 1;
  let dominant: DominantSystem = null;
  let dominance = 0;
  for (const k of Object.keys(shares) as Array<Exclude<DominantSystem, null>>) {
    const share = shares[k] / total;
    if (share > dominance) {
      dominance = share;
      dominant = k;
    }
  }

  return {
    roughness,
    clearcoat,
    transmission,
    warmthMix,
    movieMix,
    glow,
    surfaceComplexity,
    density,
    symmetry,
    dominant,
    dominance,
  };
}

/** Домішує тон (рецепти/фільми) у колір гілки — застосовується один раз при побудові геометрії. */
export function tintBranchColors(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix'>,
): { colorA: THREE.Color; colorB: THREE.Color } {
  const a = new THREE.Color(branch.colorA);
  const b = new THREE.Color(branch.colorB);
  if (material.warmthMix > 0) {
    a.lerp(WARMTH_COLOR, material.warmthMix * 0.5);
    b.lerp(WARMTH_COLOR, material.warmthMix * 0.6);
  }
  if (material.movieMix > 0) {
    a.lerp(MOVIE_COLOR, material.movieMix * 0.35);
    b.lerp(MOVIE_COLOR, material.movieMix * 0.45);
  }
  return { colorA: a, colorB: b };
}

// ── Геометрія гілки: гранована призма → гранена гостра верхівка ──
// (той самий принцип, що v1, але тепер параметризований maturity:
// молода гілка — тупіша/тонша/коротша, зріла — гостра/товста/повна).
export function buildBranchGeometry(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix' | 'surfaceComplexity'>,
): THREE.BufferGeometry {
  const shapeRng = mulberry32(hashSeedString(branch.key));
  // Книги («складність поверхні») додають шанс на зайву грань понад базові 5–7.
  const segments = 5 + Math.floor(shapeRng() * 3) + (shapeRng() < material.surfaceComplexity ? 1 : 0);
  const m = branch.maturity;

  const h = branch.height * (0.32 + m * 0.68);
  const r = branch.radiusBottom * (0.4 + m * 0.6);
  const tipR = r * (0.14 - m * 0.12); // молоді — тупіші вістря, зрілі — майже гострі
  const pointStart = 0.72 - m * 0.2 + shapeRng() * 0.08;

  const profile = [
    new THREE.Vector2(Math.max(0.001, r * (0.88 + shapeRng() * 0.1)), 0),
    new THREE.Vector2(r, h * (0.08 + shapeRng() * 0.05)),
    new THREE.Vector2(r * (0.94 + shapeRng() * 0.06), h * pointStart),
    new THREE.Vector2(Math.max(0.001, tipR), h),
  ];

  const geo = new THREE.LatheGeometry(profile, segments);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const { colorA, colorB } = tintBranchColors(branch, material);
  const c = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const t = h > 0 ? pos.getY(i) / h : 0;
    c.lerpColors(colorA, colorB, Math.min(1, Math.max(0, t)));
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// ── Основа: потріскана мінеральна брила замість сфери ─────────────
/**
 * IcosahedronGeometry з детермінованим per-vertex зміщенням уздовж
 * нормалі — «rock displacement», класична дешева техніка процедурного
 * каменю. Знизу сплюснута сильніше (widthSquash) — щоб виглядало як
 * уламок породи, з якого росте друз, а не ідеальна куля/еліпсоїд.
 */
export function buildFoundationGeometry(seedNum: number, radius = 0.4): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.sqrt(x * x + y * y + z * z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    const vRng = mulberry32(seedNum + i * 131 + 7);
    const jitter = 0.82 + vRng() * 0.34; // потрісканий, нерівний рельєф
    const squash = ny < 0 ? 0.5 : 0.82; // ширша й приплюснутіша знизу — «уламок породи»

    pos.setXYZ(i, nx * len * jitter, ny * len * jitter * squash, nz * len * jitter);
  }

  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}
