// ============================================================
// crystalGeometry — детермінована побудова граней кристала з ДНК пари
// ------------------------------------------------------------
// Форма/позиція КОЖНОЇ грані залежить лише від (індекс категорії,
// індекс грані в категорії) через невеликий seeded PRNG — тому коли
// з'являється нова грань, старі не «перетасовуються». Кристал росте,
// а не мерехтить по-новому щоразу.
// ============================================================
import type { CrystalDNA } from './useCrystal';

/** mulberry32 — детермінований 32-бітний PRNG, без нової залежності. */
function mulberry32(seed: number) {
  let s = seed | 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CrystalCategoryKey =
  | 'time'
  | 'places'
  | 'media'
  | 'cozy'
  | 'family'
  | 'wishes'
  | 'memories';

interface CategoryDef {
  key: CrystalCategoryKey;
  label: string;
  colorA: string;
  colorB: string;
  metric: (d: CrystalDNA) => number;
  facetsFor: (metric: number) => number;
}

const MAX_SLOTS = 7;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const grown = (metric: number, per: number) =>
  metric <= 0 ? 0 : clamp(Math.ceil(metric / per), 1, MAX_SLOTS);

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    key: 'time',
    label: 'Час разом',
    colorA: '#d98aa8',
    colorB: '#f6c9da',
    metric: (d) => d.daysTogether,
    facetsFor: (m) => (m <= 0 ? 0 : clamp(1 + Math.floor(m / 45), 1, MAX_SLOTS)),
  },
  {
    key: 'places',
    label: 'Місця',
    colorA: '#2fb6a8',
    colorB: '#8fe0d6',
    metric: (d) => d.places,
    facetsFor: (m) => grown(m, 2),
  },
  {
    key: 'media',
    label: 'Історії',
    colorA: '#8a6fd9',
    colorB: '#c9b8f2',
    metric: (d) => d.moviesWatched + d.booksRead,
    facetsFor: (m) => grown(m, 3),
  },
  {
    key: 'cozy',
    label: 'Затишок',
    colorA: '#e08a3c',
    colorB: '#f6c98a',
    metric: (d) => d.recipesSaved,
    facetsFor: (m) => grown(m, 2),
  },
  {
    key: 'family',
    label: 'Досягнення',
    colorA: '#d9a441',
    colorB: '#f3d78a',
    metric: (d) => d.goalsAchieved + d.anniversaries,
    facetsFor: (m) => grown(m, 1),
  },
  {
    key: 'wishes',
    label: 'Бажання',
    colorA: '#e0527a',
    colorB: '#f6a8c0',
    metric: (d) => d.wishesDone,
    facetsFor: (m) => grown(m, 2),
  },
  {
    key: 'memories',
    label: 'Фотографії',
    colorA: '#e8ddc8',
    colorB: '#fff7ea',
    metric: (d) => d.photos,
    facetsFor: (m) => grown(m, 8),
  },
];

export interface Facet {
  id: string;
  category: CrystalCategoryKey;
  slotIndex: number;
  points: string;
  fillId: string;
}

const CX = 100;
const CY = 100;
const CORE_R = 34;
const ARC = 360 / CATEGORY_DEFS.length;

function polar(r: number, deg: number): readonly [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)] as const;
}

function kite(innerR: number, midR: number, outerR: number, angle: number, halfWidth: number): string {
  const pts = [
    polar(innerR, angle),
    polar(midR, angle - halfWidth),
    polar(outerR, angle),
    polar(midR, angle + halfWidth),
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

/** Трапецієподібна грань (кільцевий сегмент) — виглядає як справжня огранка, не «шип». */
function wedge(innerR: number, outerR: number, angleStart: number, angleEnd: number): string {
  const pts = [
    polar(innerR, angleStart),
    polar(outerR, angleStart),
    polar(outerR, angleEnd),
    polar(innerR, angleEnd),
  ];
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

// Фіксоване 8-гранне ядро — завжди присутнє, однакове для кожної пари
// (символ «дні разом»), не залежить від ДНК.
const BASE_SEED_FACETS: Facet[] = Array.from({ length: 8 }, (_, i) => {
  const angle = (360 / 8) * i;
  return {
    id: `core-${i}`,
    category: 'time',
    slotIndex: -1,
    points: kite(0, CORE_R * 0.65, CORE_R, angle, 20),
    fillId: 'crystal-grad-core',
  };
});

// Кожна нова грань у категорії — це концентричне кільце навколо ядра
// (шар за шаром, як росте справжній кристал), а не тонкий промінь —
// сектор категорії лишається широким на всю свою дугу.
const ARC_GAP = 3;
const RING_STEP = 9;
const RING_DEPTH = 9;

/** Будує повний набір граней кристала з ДНК пари. Детерміновано за (категорія, слот). */
export function buildFacets(dna: CrystalDNA): Facet[] {
  const facets: Facet[] = [...BASE_SEED_FACETS];
  CATEGORY_DEFS.forEach((cat, catIdx) => {
    const count = cat.facetsFor(cat.metric(dna));
    const arcStart = catIdx * ARC + ARC_GAP / 2;
    const arcEnd = (catIdx + 1) * ARC - ARC_GAP / 2;
    for (let i = 0; i < count; i++) {
      const rng = mulberry32(catIdx * 1000 + i);
      const jitterA = (rng() - 0.5) * 2.5;
      const innerR = CORE_R + i * RING_STEP + (rng() - 0.5) * 2;
      const outerR = innerR + RING_DEPTH + rng() * 3;
      facets.push({
        id: `${cat.key}-${i}`,
        category: cat.key,
        slotIndex: i,
        points: wedge(innerR, outerR, arcStart + jitterA, arcEnd + jitterA),
        fillId: `crystal-grad-${cat.key}`,
      });
    }
  });
  return facets;
}
