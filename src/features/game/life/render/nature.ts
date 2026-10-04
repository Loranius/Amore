// ============================================================
// Дерева «Дєвочка в городі» (ADR-0239): кожне — кілька шарів крони (тінь,
// тон, відблиск), стовбур із корою, тінь на землі. Пори року міняють
// усе: весною вишня й яблуня в цвіту, восени крона жовта й руда, взимку
// голе гілля зі снігом, а ялина й сосна — в снігових шапках.
// ============================================================
import type { Season } from '../sim/calendar';
import type { Tree, TreeKind } from '../world/types';
import { PALETTES } from './palette';
import { canvas, cellHash, ctx2d, disc, ellipse, outline, px, rect, shade, type Ctx } from './pixel';

const TW = 34;
const TH = 48;
/** Точка основи стовбура в спрайті. */
export const TREE_BASE = { x: 17, y: 46 };

function trunk(g: Ctx, kind: TreeKind, top: number): void {
  const bark = kind === 'birch' ? '#efeae0' : kind === 'pine' ? '#7a4a2a' : '#8a5a34';
  rect(g, 15, top, 5, TREE_BASE.y - top, bark);
  rect(g, 15, top, 1, TREE_BASE.y - top, shade(bark, 0.15));
  rect(g, 19, top, 1, TREE_BASE.y - top, shade(bark, -0.3));
  // Коріння.
  rect(g, 13, TREE_BASE.y - 2, 9, 2, bark);
  px(g, 12, TREE_BASE.y - 1, bark);
  px(g, 22, TREE_BASE.y - 1, shade(bark, -0.2));
  if (kind === 'birch') for (let y = top + 2; y < TREE_BASE.y - 2; y += 4) rect(g, 15 + (y % 3), y, 2, 1, '#2b2b2b');
  else for (let y = top + 3; y < TREE_BASE.y - 2; y += 5) px(g, 17, y, shade(bark, -0.25));
}

function canopy(g: Ctx, blobs: readonly [number, number, number][], dark: string, mid: string, light: string, seed: number): void {
  for (const [x, y, r] of blobs) disc(g, x, y + 1, r, dark);
  for (const [x, y, r] of blobs) disc(g, x - 1, y - 1, r - 1, mid);
  for (const [x, y, r] of blobs) disc(g, x - Math.ceil(r / 3), y - Math.ceil(r / 2), Math.max(1, Math.floor(r / 2.4)), light);
  // Листя-крапки.
  for (let k = 0; k < 26; k += 1) {
    const h = cellHash(k, seed, 5);
    const [bx, by, br] = blobs[h % blobs.length]!;
    const ang = ((h >> 4) % 360) * (Math.PI / 180);
    const rr = ((h >> 12) % 100) / 100 * (br - 1);
    px(g, bx + Math.cos(ang) * rr, by + Math.sin(ang) * rr, (h >> 20) % 2 ? light : dark);
  }
}

function blossoms(g: Ctx, blobs: readonly [number, number, number][], color: string, seed: number, count: number): void {
  for (let k = 0; k < count; k += 1) {
    const h = cellHash(k, seed, 9);
    const [bx, by, br] = blobs[h % blobs.length]!;
    const ang = ((h >> 4) % 360) * (Math.PI / 180);
    const rr = ((h >> 12) % 100) / 100 * br;
    const x = Math.round(bx + Math.cos(ang) * rr);
    const y = Math.round(by + Math.sin(ang) * rr);
    px(g, x, y, color);
    if (k % 3 === 0) px(g, x + 1, y, shade(color, -0.1));
  }
}

function bareBranches(g: Ctx, seed: number, snow: boolean): void {
  const bark = '#7a5a44';
  const lines: [number, number, number, number][] = [[17, 30, 9, 14], [17, 28, 26, 12], [17, 24, 17, 6], [12, 20, 6, 12], [22, 18, 29, 10], [17, 16, 12, 4]];
  for (const [x0, y0, x1, y1] of lines) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = 0; k <= n; k += 1) {
      const x = Math.round(x0 + ((x1 - x0) * k) / n);
      const y = Math.round(y0 + ((y1 - y0) * k) / n);
      px(g, x, y, bark);
      if (k < n / 2) px(g, x + 1, y, bark);
      if (snow && k % 2 === 0) px(g, x, y - 1, '#ffffff');
    }
  }
  if (cellHash(seed, 1) % 2 === 0) disc(g, 22, 22, 2, '#5a4a3a'); // гніздо
}

const cache = new Map<string, HTMLCanvasElement>();

export function treeSprite(tree: Tree, season: Season): HTMLCanvasElement {
  const seed = cellHash(Math.round(tree.x * 7), Math.round(tree.y * 7), 3);
  const variant = seed % 3;
  const key = `${tree.kind}|${season}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = canvas(TW, TH);
  const g = ctx2d(c);
  const P = PALETTES[season];
  const kind = tree.kind;

  if (kind === 'pine') {
    trunk(g, kind, 36);
    const tiers: [number, number][] = [[38, 14], [30, 12], [22, 10], [14, 7], [7, 4]];
    tiers.forEach(([base, half], k) => {
      for (let r = 0; r < 11; r += 1) {
        const w = Math.round((half * r) / 10);
        const y = base - 10 + r;
        rect(g, 17 - w, y, w * 2 + 1, 1, r > 7 ? '#2f5f3a' : '#3f7a46');
        if (r > 2) px(g, 17 - w + 1, y, '#5a9a5a');
      }
      // Опущені кінчики лап.
      px(g, 17 - half, base + 1, '#2f5f3a');
      px(g, 17 + half, base + 1, '#2f5f3a');
      if (P.snow) {
        for (let r = 0; r < 4; r += 1) {
          const w = Math.round((half * (r + 1)) / 10);
          rect(g, 17 - w, base - 10 + r + 1, w * 2 + 1, 1, '#ffffff');
        }
        px(g, 17 - half + 2, base - 2, '#ffffff');
      }
      if (k === 4) px(g, 17, 1, '#3f7a46');
    });
  } else if (kind === 'poplar') {
    trunk(g, kind, 38);
    const blobs: [number, number, number][] = [[17, 34, 7], [17, 26, 7], [17, 18, 6], [17, 11, 5], [17, 5, 3]];
    if (P.snow) bareBranches(g, seed, true);
    else canopy(g, blobs, P.leafDark, P.leaf, P.leafLight, seed);
  } else if (kind === 'willow') {
    trunk(g, kind, 26);
    if (P.snow) bareBranches(g, seed, true);
    else {
      const blobs: [number, number, number][] = [[17, 18, 11], [9, 22, 6], [25, 22, 6]];
      canopy(g, blobs, P.leafDark, P.leaf, P.leafLight, seed);
      // Звисле гілля.
      for (let x = 5; x < 30; x += 2) {
        const len = 8 + (cellHash(x, seed) % 10);
        rect(g, x, 22, 1, len, x % 4 === 1 ? P.leafLight : P.leaf);
      }
    }
  } else {
    trunk(g, kind, kind === 'birch' ? 22 : 26);
    const blobs: [number, number, number][] = kind === 'birch'
      ? [[17, 16, 8], [11, 21, 6], [23, 21, 6], [17, 9, 5]]
      : variant === 0
        ? [[17, 18, 10], [9, 23, 7], [25, 23, 7], [13, 11, 7], [22, 12, 6]]
        : variant === 1
          ? [[17, 17, 11], [8, 24, 6], [26, 22, 7], [17, 8, 6]]
          : [[16, 19, 10], [24, 17, 8], [10, 14, 7], [18, 9, 6]];
    if (P.snow) {
      bareBranches(g, seed, true);
    } else {
      let dark = P.leafDark;
      let mid = P.leaf;
      let light = P.leafLight;
      if (season === 'autumn' && (kind === 'birch' || variant === 2)) { dark = '#c9a024'; mid = '#e8c03a'; light = '#f6dc6a'; }
      if (season === 'autumn' && kind === 'chestnut') { dark = '#9a4a20'; mid = '#c96a2a'; light = '#e8964a'; }
      canopy(g, blobs, dark, mid, light, seed);
      if (season === 'spring' && kind === 'cherry') blossoms(g, blobs, '#ffc4dc', seed, 70);
      if (season === 'spring' && kind === 'apple') blossoms(g, blobs, '#fff4f8', seed, 55);
      if (season === 'spring' && kind === 'chestnut') blossoms(g, blobs, '#fff8e8', seed, 18);
      if (season === 'summer' && kind === 'cherry') blossoms(g, blobs, '#c2283a', seed, 16);
      if ((season === 'summer' || season === 'autumn') && kind === 'apple') blossoms(g, blobs, '#e8402e', seed, 14);
    }
  }
  const out = outline(c, '#2a2a22');
  cache.set(key, out);
  return out;
}

export function drawTreeShadow(g: Ctx, x: number, y: number, kind: TreeKind): void {
  const w = kind === 'pine' || kind === 'poplar' ? 9 : 13;
  ellipse(g, x + 3, y - 1, w, 3, 'rgba(28,20,40,0.24)');
}

/** Опале листя / пелюстки під деревом — розсип на землі. */
export function drawLeafLitter(g: Ctx, x: number, y: number, season: Season, kind: TreeKind, seed: number): void {
  if (season === 'autumn' && kind !== 'pine') {
    for (let k = 0; k < 7; k += 1) {
      const h = cellHash(k, seed, 13);
      px(g, x - 10 + (h % 22), y - 4 + ((h >> 5) % 8), ['#e08a2e', '#f2b44a', '#b85a24'][h % 3]!);
    }
  }
  if (season === 'spring' && kind === 'cherry') {
    for (let k = 0; k < 8; k += 1) {
      const h = cellHash(k, seed, 17);
      px(g, x - 10 + (h % 22), y - 4 + ((h >> 5) % 8), '#ffc4dc');
    }
  }
}
