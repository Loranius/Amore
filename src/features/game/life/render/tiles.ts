// ============================================================
// Земля «Дєвочка в городі» (ADR-0239): трава з травинками й квітами,
// стежки з рваним краєм трави, бруківка, плитка, асфальт, пісок, вода,
// колія, живопліт, паркан, підлоги кімнат.
// ------------------------------------------------------------
// Уся нерухома земля мапи малюється ОДИН раз на пору року в окреме
// полотно; щокадру домальовується лише вода.
// ============================================================
import type { Season } from '../sim/calendar';
import { TILE, type GameMap, type Ground } from '../world/types';
import { PALETTES, type SeasonPalette } from './palette';
import { canvas, cellHash, ctx2d, mix, px, rect, shade, type Ctx } from './pixel';

const SOFT: ReadonlySet<Ground> = new Set<Ground>(['d', 'c', 'p', 's', 'b', 'a', 'm', 'z']);
const GRASSY: ReadonlySet<Ground> = new Set<Ground>(['g', 'G', 'h', 'F']);

function grassTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette, flowers: boolean): void {
  rect(g, x, y, TILE, TILE, P.grass);
  const h = cellHash(i, j);
  // Світлі й темні плями — трава нерівна.
  if (h % 5 === 0) rect(g, x + (h % 9), y + ((h >> 4) % 9), 6, 4, P.grassLight);
  if (h % 7 === 1) rect(g, x + ((h >> 3) % 10), y + ((h >> 6) % 10), 5, 3, P.grassDark);
  // Травинки: «галочки» по 2 пікселі.
  for (let k = 0; k < 4; k += 1) {
    const hh = cellHash(i, j, k + 1);
    const bx = x + (hh % 14) + 1;
    const by = y + ((hh >> 5) % 13) + 2;
    if (P.snow) {
      if (hh % 3 === 0) px(g, bx, by, P.grassDark);
      continue;
    }
    px(g, bx, by, P.blade);
    px(g, bx - 1, by - 1, P.blade);
    px(g, bx + 1, by - 1, P.blade);
    if (hh % 4 === 0) px(g, bx, by - 2, P.grassLight);
  }
  if (flowers && !P.snow) {
    for (let k = 0; k < 3; k += 1) {
      const hh = cellHash(i, j, k + 11);
      const fx = x + 2 + (hh % 11);
      const fy = y + 2 + ((hh >> 4) % 11);
      const c = P.flowers[hh % P.flowers.length]!;
      px(g, fx, fy + 1, P.blade);
      px(g, fx, fy, c);
      px(g, fx - 1, fy, c);
      px(g, fx + 1, fy, c);
      px(g, fx, fy - 1, c);
      px(g, fx, fy, '#fff6b0');
    }
  }
  if (flowers && P.snow) {
    const hh = cellHash(i, j, 5);
    rect(g, x + (hh % 8), y + 6, 7, 3, '#ffffff');
    rect(g, x + (hh % 8) + 1, y + 9, 6, 1, P.grassDark);
  }
}

function dirtTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette): void {
  const base = P.snow ? mix(P.dirt, '#e9eef6', 0.55) : P.dirt;
  rect(g, x, y, TILE, TILE, base);
  for (let k = 0; k < 5; k += 1) {
    const hh = cellHash(i, j, k + 21);
    const c = hh % 3 === 0 ? shade(base, 0.12) : shade(base, -0.12);
    rect(g, x + (hh % 14), y + ((hh >> 4) % 14), hh % 2 ? 2 : 1, 1, c);
  }
  if (cellHash(i, j, 9) % 6 === 0) {
    const hh = cellHash(i, j, 10);
    rect(g, x + (hh % 11) + 1, y + ((hh >> 3) % 11) + 2, 3, 2, shade(base, -0.25));
    px(g, x + (hh % 11) + 1, y + ((hh >> 3) % 11) + 2, shade(base, 0.2));
  }
}

function cobbleTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette): void {
  const mortar = P.snow ? '#c9d2df' : '#8a8478';
  rect(g, x, y, TILE, TILE, mortar);
  const stones = [[0, 0, 7, 5], [8, 0, 8, 5], [0, 6, 4, 4], [5, 6, 6, 4], [12, 6, 4, 4], [0, 11, 8, 5], [9, 11, 7, 5]] as const;
  stones.forEach(([sx, sy, sw, sh], k) => {
    const hh = cellHash(i, j, k + 31);
    const tones = P.snow ? ['#e4e9f1', '#d8dfea', '#eef2f8'] : ['#b9ae9a', '#a99f8b', '#c6bba6', '#9f9584'];
    const c = tones[hh % tones.length]!;
    rect(g, x + sx, y + sy, sw - 1, sh - 1, c);
    rect(g, x + sx, y + sy, sw - 1, 1, shade(c, 0.15));
    rect(g, x + sx, y + sy + sh - 2, sw - 1, 1, shade(c, -0.15));
  });
}

function paveTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette): void {
  const base = P.snow ? '#e3e8f0' : (i + j) % 2 === 0 ? '#d4cbbb' : '#cbc1b0';
  rect(g, x, y, TILE, TILE, base);
  rect(g, x, y + 7, TILE, 1, shade(base, -0.14));
  rect(g, x + 7, y, 1, TILE, shade(base, -0.14));
  rect(g, x, y, TILE, 1, shade(base, 0.1));
  if (cellHash(i, j) % 9 === 0) px(g, x + 3, y + 11, shade(base, -0.2));
}

function asphaltTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette, mark: 'm' | 'z' | 'a'): void {
  const base = P.snow ? '#9aa1ad' : '#5f6168';
  rect(g, x, y, TILE, TILE, base);
  for (let k = 0; k < 6; k += 1) {
    const hh = cellHash(i, j, k + 41);
    px(g, x + (hh % 16), y + ((hh >> 4) % 16), hh % 2 ? shade(base, 0.12) : shade(base, -0.12));
  }
  if (mark === 'm' && i % 2 === 0) rect(g, x + 2, y + 7, 10, 2, '#e9e4cf');
  if (mark === 'z') for (let k = 0; k < 4; k += 1) rect(g, x + k * 4, y + 1, 2, 14, '#ecebe4');
}

function sandTile(g: Ctx, x: number, y: number, i: number, j: number, wet: boolean): void {
  const base = wet ? '#d2b679' : '#ecd69a';
  rect(g, x, y, TILE, TILE, base);
  for (let k = 0; k < 6; k += 1) {
    const hh = cellHash(i, j, k + 51);
    px(g, x + (hh % 16), y + ((hh >> 4) % 16), hh % 3 === 0 ? '#f8ebc0' : shade(base, -0.1));
  }
  if (!wet && cellHash(i, j, 3) % 23 === 0) {
    // Мушля.
    rect(g, x + 6, y + 8, 3, 2, '#fbe7e1');
    px(g, x + 7, y + 7, '#f0c4b8');
  }
}

function railTile(g: Ctx, x: number, y: number, i: number, j: number): void {
  rect(g, x, y, TILE, TILE, '#7d7568');
  for (let k = 0; k < 6; k += 1) {
    const hh = cellHash(i, j, k + 61);
    px(g, x + (hh % 16), y + ((hh >> 4) % 16), hh % 2 ? '#948b7c' : '#655e53');
  }
  for (let k = 0; k < 4; k += 1) rect(g, x + k * 4, y + 3, 3, 10, '#6b4a30');
  rect(g, x, y + 5, TILE, 1, '#c9ced8');
  rect(g, x, y + 6, TILE, 1, '#7c818b');
  rect(g, x, y + 10, TILE, 1, '#c9ced8');
  rect(g, x, y + 11, TILE, 1, '#7c818b');
}

function hedgeTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette): void {
  grassTile(g, x, y, i, j, P, false);
  const leaf = P.snow ? '#4f6f5c' : P.leafDark;
  rect(g, x, y + 2, TILE, 12, leaf);
  rect(g, x, y + 2, TILE, 3, P.snow ? '#ffffff' : P.leaf);
  for (let k = 0; k < 5; k += 1) {
    const hh = cellHash(i, j, k + 71);
    px(g, x + (hh % 15), y + 5 + ((hh >> 4) % 7), P.snow ? '#6f8f7a' : P.leafLight);
  }
  rect(g, x, y + 14, TILE, 1, 'rgba(20,30,20,0.35)');
}

function fenceTile(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette): void {
  grassTile(g, x, y, i, j, P, false);
  const wood = '#a8784a';
  rect(g, x, y + 5, TILE, 2, wood);
  rect(g, x, y + 10, TILE, 2, wood);
  rect(g, x, y + 5, TILE, 1, shade(wood, 0.2));
  for (const pxl of [1, 9]) {
    rect(g, x + pxl, y + 2, 3, 12, shade(wood, -0.1));
    rect(g, x + pxl, y + 2, 1, 12, shade(wood, 0.15));
    if (P.snow) rect(g, x + pxl, y + 1, 3, 2, '#ffffff');
  }
  rect(g, x, y + 14, TILE, 1, 'rgba(20,30,20,0.25)');
}

function floorTile(g: Ctx, x: number, y: number, i: number, j: number, kind: 'f' | 't' | 'k'): void {
  if (kind === 'f') {
    const base = '#c9925a';
    rect(g, x, y, TILE, TILE, base);
    for (let r = 0; r < 4; r += 1) {
      const tone = cellHash(i, j * 4 + r) % 3 === 0 ? shade(base, 0.08) : cellHash(i, j * 4 + r) % 3 === 1 ? shade(base, -0.06) : base;
      rect(g, x, y + r * 4, TILE, 3, tone);
      rect(g, x, y + r * 4 + 3, TILE, 1, shade(base, -0.25));
      const seam = (cellHash(i, j, r) % 12) + 2;
      rect(g, x + seam, y + r * 4, 1, 3, shade(base, -0.2));
    }
  } else if (kind === 't') {
    const a = (i + j) % 2 === 0 ? '#e9e3d6' : '#b9c7d6';
    rect(g, x, y, TILE, TILE, a);
    rect(g, x, y, TILE, 1, shade(a, 0.15));
    rect(g, x, y + 15, TILE, 1, shade(a, -0.2));
  } else {
    const base = '#9a6a8a';
    rect(g, x, y, TILE, TILE, base);
    for (let k = 0; k < 6; k += 1) px(g, x + (cellHash(i, j, k) % 16), y + (cellHash(i, j, k + 9) % 16), shade(base, 0.12));
  }
}

function wallTile(g: Ctx, x: number, y: number, i: number, j: number, map: GameMap): void {
  // Стіна кімнати: шпалери з візерунком, плінтус унизу, якщо нижче підлога.
  const below = map.ground[j + 1]?.[i];
  const paper = '#e8d9b8';
  rect(g, x, y, TILE, TILE, paper);
  for (let k = 0; k < 16; k += 4) {
    rect(g, x + k + 1, y, 1, TILE, '#ddc9a2');
  }
  if ((i + j) % 2 === 0) { px(g, x + 3, y + 6, '#d98a8a'); px(g, x + 11, y + 12, '#8ab0d9'); }
  if (below && below !== 'W' && below !== 'x') {
    rect(g, x, y + 12, TILE, 4, '#8a5a34');
    rect(g, x, y + 12, TILE, 1, '#b07a4a');
  }
  if (j === 0) rect(g, x, y, TILE, 3, '#6e4a2a');
}

/** Рваний край трави, що лягає на стежку: стежка «врізана» в траву. */
function grassFringe(g: Ctx, map: GameMap, P: SeasonPalette): void {
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      if (!GRASSY.has(map.ground[j]![i]!)) continue;
      const x = i * TILE;
      const y = j * TILE;
      const sides: [number, number, 'h' | 'v', number, number][] = [[0, 1, 'h', x, y + TILE], [0, -1, 'h', x, y], [1, 0, 'v', x + TILE, y], [-1, 0, 'v', x, y]];
      for (const [di, dj, axis, ex, ey] of sides) {
        const n = map.ground[j + dj]?.[i + di];
        if (!n || !SOFT.has(n)) continue;
        for (let k = 0; k < TILE; k += 1) {
          const depth = 1 + (cellHash(i * 3 + di, j * 3 + dj, k) % 3);
          const len = depth;
          if (axis === 'h') {
            const yy = dj > 0 ? ey : ey - len;
            rect(g, ex + k, yy, 1, len, P.grass);
            if (dj > 0) px(g, ex + k, yy + len, 'rgba(40,30,20,0.18)');
          } else {
            const xx = di > 0 ? ex : ex - len;
            rect(g, xx, ey + k, len, 1, P.grass);
          }
        }
      }
    }
  }
}

const groundCache = new Map<string, HTMLCanvasElement>();

/** Нерухома земля мапи на цю пору року (кешується). */
export function groundCanvas(map: GameMap, season: Season): HTMLCanvasElement {
  const key = `${map.id}|${season}`;
  const hit = groundCache.get(key);
  if (hit) return hit;
  const P = PALETTES[map.interior ? 'summer' : season];
  const c = canvas(map.w * TILE, map.h * TILE);
  const g = ctx2d(c);
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = map.ground[j]![i]!;
      const x = i * TILE;
      const y = j * TILE;
      switch (t) {
        case 'g': grassTile(g, x, y, i, j, P, cellHash(i, j, 77) % 11 === 0); break;
        case 'G': grassTile(g, x, y, i, j, P, true); break;
        case 'd': dirtTile(g, x, y, i, j, P); break;
        case 'c': cobbleTile(g, x, y, i, j, P); break;
        case 'p': paveTile(g, x, y, i, j, P); break;
        case 'a': case 'm': case 'z': asphaltTile(g, x, y, i, j, P, t); break;
        case 's': sandTile(g, x, y, i, j, false); break;
        case 'b': sandTile(g, x, y, i, j, true); break;
        case 'r': railTile(g, x, y, i, j); break;
        case 'h': hedgeTile(g, x, y, i, j, P); break;
        case 'F': fenceTile(g, x, y, i, j, P); break;
        case 'f': case 't': case 'k': floorTile(g, x, y, i, j, t); break;
        case 'W': wallTile(g, x, y, i, j, map); break;
        case 'w': rect(g, x, y, TILE, TILE, P.water); break;
        case 'x': rect(g, x, y, TILE, TILE, '#1b1420'); break;
      }
    }
  }
  if (!map.interior) grassFringe(g, map, P);
  groundCache.set(key, c);
  return c;
}

/**
 * Вода щокадру: брижі, що біжать, піна біля берега, лід на ставку взимку.
 * Малюється лише у видимому вікні.
 */
export function drawWater(g: Ctx, map: GameMap, season: Season, time: number, i0: number, j0: number, i1: number, j1: number): void {
  const P = PALETTES[season];
  const frozen = season === 'winter' && map.pondFreezes;
  for (let j = j0; j <= j1; j += 1) {
    for (let i = i0; i <= i1; i += 1) {
      if (map.ground[j]?.[i] !== 'w') continue;
      const x = i * TILE;
      const y = j * TILE;
      if (frozen) {
        rect(g, x, y, TILE, TILE, '#cfe6f5');
        if (cellHash(i, j) % 4 === 0) rect(g, x + 3, y + 5, 7, 1, '#ffffff');
        if (cellHash(i, j) % 5 === 1) rect(g, x + 8, y + 10, 5, 1, '#a9cfe6');
        continue;
      }
      const deep = ['w', undefined].includes(map.ground[j - 1]?.[i]) && map.ground[j + 1]?.[i] === 'w';
      rect(g, x, y, TILE, TILE, deep ? shade(P.water, -0.08) : P.water);
      const phase = Math.floor(time * 2.2 + cellHash(i, j) % 7) % 6;
      const hh = cellHash(i, j, 3);
      if (phase < 3) rect(g, x + (hh % 8) + phase, y + ((hh >> 4) % 10) + 2, 4, 1, P.waterLight);
      if ((phase + 3) % 6 < 2) rect(g, x + ((hh >> 2) % 9), y + ((hh >> 6) % 9) + 5, 3, 1, shade(P.water, 0.15));
      // Сонячні відблиски.
      if ((Math.floor(time * 3) + i * 7 + j * 3) % 37 === 0) px(g, x + 6, y + 6, '#ffffff');
      // Піна біля берега.
      const up = map.ground[j - 1]?.[i];
      if (up && up !== 'w') {
        const wave = Math.round(Math.sin(time * 2 + i) * 1.2);
        rect(g, x, y, TILE, 2 + Math.max(0, wave), '#e9f6ff');
        rect(g, x, y + 2 + Math.max(0, wave), TILE, 1, P.waterLight);
      }
      if (map.ground[j]?.[i - 1] && map.ground[j]![i - 1] !== 'w') rect(g, x, y, 1, TILE, '#d8eefc');
      if (map.ground[j]?.[i + 1] && map.ground[j]![i + 1] !== 'w') rect(g, x + 15, y, 1, TILE, '#d8eefc');
    }
  }
}
