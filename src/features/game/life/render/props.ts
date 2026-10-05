// ============================================================
// Дрібниці світу «Дєвочка в городі» (ADR-0239): лавки, ліхтарі, криниця,
// фонтани, ринкові ятки, машини, гойдалки, парасолі на пляжі, Жовтий
// камінь — і живність: кури, кіт, качки, чайки. Плюс меблі кімнати.
// ------------------------------------------------------------
// Пропи малюються щокадру (їх небагато), бо частина з них рухається.
// ============================================================
import type { Season } from '../sim/calendar';
import { TILE, type Prop, type PropType, type Rect } from '../world/types';
import { PALETTES } from './palette';
import { cellHash, disc, ellipse, px, rect, shade, type Ctx } from './pixel';

/** Нижня межа пропа для сортування за глибиною (пікселі світу). */
export function propBase(p: Prop): number {
  const y = p.y * TILE;
  switch (p.type) {
    case 'rug': case 'sandbox': case 'flowerBed': case 'pier': case 'stairs': case 'poster': case 'window': case 'rushnyk': case 'clock':
      return y - 100; // лежить на землі чи висить на стіні — під усім
    case 'bigFountain': return y + 40;
    case 'lighthouse': return y + 30;
    case 'tram': return y + 22;
    case 'car': return y + 14;
    case 'gull': return y + 999; // над усім
    default: return y + 14;
  }
}

const SOLID: ReadonlySet<PropType> = new Set<PropType>([
  'bench', 'lamp', 'well', 'mailbox', 'busStop', 'fountain', 'bigFountain', 'stall', 'car', 'bin', 'planter', 'pot', 'haystack',
  'swing', 'slide', 'goal', 'flagpole', 'yellowStone', 'boat', 'lighthouse', 'cafeTable', 'signpost', 'board', 'bush', 'rock', 'statue', 'tram',
  'bed', 'plant', 'floorLamp', 'shelf', 'tv', 'table', 'stove', 'wardrobe', 'desk', 'sofa', 'fridge',
  'woodpile', 'workbench',
]);

/** Тверда частина пропа (пікселі світу) або `null`, якщо крізь нього можна пройти. */
export function propSolid(p: Prop): Rect | null {
  if (p.solid === false) return null;
  if (!SOLID.has(p.type)) return null;
  const x = p.x * TILE;
  const y = p.y * TILE;
  switch (p.type) {
    case 'bigFountain': return { x: x - 4, y: y + 8, w: 56, h: 34 };
    case 'fountain': return { x: x + 1, y: y + 6, w: 30, h: 18 };
    case 'stall': return { x, y: y + 6, w: 32, h: 10 };
    case 'car': return { x, y: y + 2, w: 30, h: 13 };
    case 'tram': return { x, y: y + 6, w: 60, h: 16 };
    case 'yellowStone': return { x: x - 2, y: y + 6, w: 36, h: 12 };
    case 'lighthouse': return { x: x + 2, y: y + 20, w: 14, h: 12 };
    case 'boat': return { x, y: y + 4, w: 28, h: 10 };
    case 'bed': return { x, y, w: 16, h: 28 };
    case 'sofa': return { x, y: y + 2, w: 30, h: 12 };
    case 'table': case 'desk': return { x, y: y + 2, w: 24, h: 12 };
    case 'shelf': case 'wardrobe': case 'fridge': case 'stove': return { x, y, w: 16, h: 14 };
    case 'woodpile': return { x, y: y + 6, w: 28, h: 9 };
    case 'workbench': return { x, y: y + 6, w: 22, h: 9 };
    case 'swing': return { x, y: y + 10, w: 26, h: 6 };
    case 'goal': return { x, y: y + 12, w: 4, h: 4 };
    case 'lamp': case 'flagpole': case 'signpost': return { x: x + 6, y: y + 12, w: 4, h: 4 };
    default: return { x: x + 2, y: y + 8, w: 12, h: 7 };
  }
}

/** Де світить вночі (центри, пікселі світу) і наскільки широко. */
export function propLight(p: Prop): { x: number; y: number; r: number } | null {
  const x = p.x * TILE;
  const y = p.y * TILE;
  if (p.type === 'lamp') return { x: x + 8, y: y - 6, r: 44 };
  if (p.type === 'floorLamp') return { x: x + 8, y: y - 2, r: 40 };
  if (p.type === 'lighthouse') return { x: x + 9, y: y - 14, r: 70 };
  if (p.type === 'busStop') return { x: x + 12, y: y, r: 26 };
  if (p.type === 'stove') return { x: x + 8, y: y + 8, r: 26 };
  if (p.type === 'tv') return { x: x + 8, y: y + 4, r: 22 };
  return null;
}

function shadow(g: Ctx, cx: number, cy: number, rx: number, ry = 2): void {
  ellipse(g, cx, cy, rx, ry, 'rgba(28,20,40,0.22)');
}

export function drawProp(g: Ctx, p: Prop, season: Season, t: number): void {
  const x = Math.round(p.x * TILE);
  const y = Math.round(p.y * TILE);
  const P = PALETTES[season];
  const snow = P.snow;
  const seed = cellHash(Math.round(p.x * 5), Math.round(p.y * 5), 1);
  switch (p.type) {
    case 'bench': {
      shadow(g, x + 9, y + 14, 9);
      rect(g, x + 1, y + 4, 16, 3, '#9a6a3a');
      rect(g, x + 1, y + 4, 16, 1, '#c08a52');
      rect(g, x + 1, y + 8, 16, 3, '#9a6a3a');
      rect(g, x + 1, y + 8, 16, 1, '#c08a52');
      rect(g, x + 2, y + 11, 2, 3, '#3a3a40');
      rect(g, x + 14, y + 11, 2, 3, '#3a3a40');
      if (snow) rect(g, x + 1, y + 7, 16, 1, '#ffffff');
      break;
    }
    case 'lamp': {
      shadow(g, x + 8, y + 15, 4);
      rect(g, x + 7, y - 10, 2, 25, '#3a3f4a');
      rect(g, x + 6, y + 12, 4, 3, '#2b2f38');
      rect(g, x + 4, y - 14, 8, 5, '#3a3f4a');
      rect(g, x + 5, y - 13, 6, 3, '#ffe9a8');
      px(g, x + 8, y - 15, '#3a3f4a');
      if (snow) rect(g, x + 4, y - 15, 8, 1, '#ffffff');
      break;
    }
    case 'well': {
      shadow(g, x + 10, y + 15, 10);
      rect(g, x + 2, y + 6, 16, 9, '#8a8478');
      for (let k = 0; k < 16; k += 4) rect(g, x + 2 + k, y + 6, 1, 9, '#6e6a60');
      rect(g, x + 2, y + 6, 16, 2, '#a8a294');
      rect(g, x + 4, y + 7, 12, 2, '#2b3a4a');
      rect(g, x + 3, y - 6, 2, 13, '#7a4a2a');
      rect(g, x + 15, y - 6, 2, 13, '#7a4a2a');
      rect(g, x, y - 9, 20, 4, snow ? '#ffffff' : '#b0563c');
      rect(g, x + 2, y - 11, 16, 2, snow ? '#ffffff' : '#c96a4c');
      rect(g, x + 9, y - 5, 1, 8, '#8a6a4a');
      rect(g, x + 8, y + 2, 3, 3, '#7a5a3a');
      break;
    }
    case 'mailbox': {
      rect(g, x + 7, y + 6, 2, 9, '#5a5a64');
      rect(g, x + 4, y, 8, 7, '#3a6fd8');
      rect(g, x + 4, y, 8, 2, '#5a8fe8');
      rect(g, x + 6, y + 3, 4, 1, '#1b2b4a');
      break;
    }
    case 'busStop': {
      shadow(g, x + 14, y + 15, 14);
      rect(g, x + 1, y - 8, 2, 23, '#5a6270');
      rect(g, x + 25, y - 8, 2, 23, '#5a6270');
      rect(g, x - 1, y - 11, 30, 4, '#3a6fd8');
      rect(g, x - 1, y - 11, 30, 1, '#6a9ff0');
      rect(g, x + 3, y - 7, 22, 12, 'rgba(180,220,240,0.45)');
      rect(g, x + 4, y + 7, 20, 3, '#8a6a4a');
      if (snow) rect(g, x - 1, y - 12, 30, 2, '#ffffff');
      // Табличка «А».
      rect(g, x + 28, y - 16, 7, 7, '#f6c14e');
      rect(g, x + 30, y - 14, 3, 3, '#3a6fd8');
      rect(g, x + 31, y - 9, 1, 24, '#5a6270');
      break;
    }
    case 'fountain': {
      shadow(g, x + 16, y + 22, 16, 3);
      ellipse(g, x + 16, y + 16, 15, 7, '#b8b0a2');
      ellipse(g, x + 16, y + 15, 13, 5, season === 'winter' ? '#cfe6f5' : '#4c9ad6');
      rect(g, x + 14, y + 2, 4, 13, '#d8d0c2');
      ellipse(g, x + 16, y + 4, 6, 2, '#b8b0a2');
      if (season !== 'winter') {
        for (let k = 0; k < 6; k += 1) {
          const ph = (t * 1.6 + k / 6) % 1;
          const dx = Math.cos(k) * ph * 9;
          px(g, x + 16 + dx, y + 2 - Math.sin(ph * Math.PI) * 6 + ph * 8, '#d9f0fb');
        }
        px(g, x + 16, y - 2 + Math.round(Math.sin(t * 8)), '#ffffff');
      }
      break;
    }
    case 'bigFountain': {
      // Вінницький фонтан: широке коло, струмені, що «танцюють».
      shadow(g, x + 24, y + 40, 30, 4);
      ellipse(g, x + 24, y + 30, 30, 12, '#a89f8f');
      ellipse(g, x + 24, y + 29, 27, 10, season === 'winter' ? '#cfe6f5' : '#3f8fcf');
      if (season !== 'winter') {
        for (let k = 0; k < 9; k += 1) {
          const jx = x + 24 + Math.cos((k / 9) * Math.PI * 2) * 18;
          const jy = y + 29 + Math.sin((k / 9) * Math.PI * 2) * 6;
          const hgt = 8 + Math.sin(t * 2.5 + k) * 6;
          rect(g, jx, jy - hgt, 1, hgt, 'rgba(217,240,251,0.85)');
          px(g, jx, jy - hgt - 1, '#ffffff');
        }
        const mid = 18 + Math.sin(t * 1.7) * 8;
        rect(g, x + 23, y + 29 - mid, 2, mid, 'rgba(230,246,255,0.9)');
        for (let k = 0; k < 8; k += 1) px(g, x + 24 + Math.cos(t * 3 + k) * 4, y + 29 - mid + Math.abs(Math.sin(t * 3 + k)) * 5, '#ffffff');
      }
      break;
    }
    case 'stall': {
      shadow(g, x + 16, y + 16, 16);
      rect(g, x, y + 6, 32, 9, '#9a6a3a');
      rect(g, x, y + 6, 32, 2, '#c08a52');
      const goods = ['#e8402e', '#f6c14e', '#7ed957', '#f39c6b', '#b8323a'];
      for (let k = 0; k < 7; k += 1) disc(g, x + 3 + k * 4, y + 5, 1, goods[(k + seed) % goods.length]!);
      rect(g, x + 1, y - 8, 2, 14, '#7a4a2a');
      rect(g, x + 29, y - 8, 2, 14, '#7a4a2a');
      for (let k = 0; k < 34; k += 1) {
        const c = Math.floor(k / 4) % 2 === 0 ? (p.tint ?? '#d9534f') : '#f8f4ec';
        rect(g, x - 1 + k, y - 12, 1, 5 + (k % 4 === 1 || k % 4 === 2 ? 1 : 0), c);
      }
      if (snow) rect(g, x - 1, y - 13, 34, 2, '#ffffff');
      break;
    }
    case 'car': {
      const c = p.tint ?? ['#d9534f', '#3a6fd8', '#f6c14e', '#f4f4f7', '#5a5a64'][seed % 5]!;
      shadow(g, x + 15, y + 15, 16, 3);
      rect(g, x, y + 5, 30, 8, c);
      rect(g, x + 5, y, 18, 6, c);
      rect(g, x + 7, y + 1, 6, 4, '#bfe3f5');
      rect(g, x + 15, y + 1, 6, 4, '#9fd0ec');
      rect(g, x, y + 5, 30, 1, shade(c, 0.25));
      rect(g, x, y + 11, 30, 2, shade(c, -0.3));
      disc(g, x + 6, y + 13, 3, '#2b2b33');
      disc(g, x + 24, y + 13, 3, '#2b2b33');
      px(g, x + 6, y + 13, '#9a9aa4');
      px(g, x + 24, y + 13, '#9a9aa4');
      rect(g, x + 28, y + 7, 2, 2, '#ffe9a8');
      if (snow) rect(g, x + 5, y - 1, 18, 2, '#ffffff');
      break;
    }
    case 'tram': {
      shadow(g, x + 30, y + 22, 32, 3);
      rect(g, x, y, 60, 18, '#e8b83a');
      rect(g, x, y + 12, 60, 6, '#c2494f');
      for (let k = 4; k < 56; k += 9) rect(g, x + k, y + 3, 7, 7, '#bfe3f5');
      rect(g, x + 28, y - 8, 1, 8, '#3a3a40');
      rect(g, x, y, 60, 1, shade('#e8b83a', 0.3));
      break;
    }
    case 'bike': {
      disc(g, x + 4, y + 11, 3, '#2b2b33');
      disc(g, x + 13, y + 11, 3, '#2b2b33');
      disc(g, x + 4, y + 11, 2, PALETTES.summer.grass);
      disc(g, x + 13, y + 11, 2, PALETTES.summer.grass);
      rect(g, x + 4, y + 8, 9, 1, p.tint ?? '#d9534f');
      rect(g, x + 8, y + 6, 1, 5, p.tint ?? '#d9534f');
      rect(g, x + 6, y + 5, 4, 1, '#3a2f28');
      rect(g, x + 12, y + 5, 3, 1, '#5a5a64');
      break;
    }
    case 'bin': {
      shadow(g, x + 8, y + 15, 5);
      rect(g, x + 4, y + 4, 8, 11, '#4f8a5a');
      rect(g, x + 3, y + 3, 10, 2, '#3f7a4a');
      rect(g, x + 4, y + 4, 2, 11, '#6fa87a');
      break;
    }
    case 'planter': case 'flowerBed': {
      if (p.type === 'planter') {
        rect(g, x + 1, y + 7, 14, 8, '#b8703a');
        rect(g, x + 1, y + 7, 14, 2, '#d08a4a');
      } else {
        rect(g, x, y + 4, 16, 10, '#7a5a3a');
      }
      if (snow) { rect(g, x + 1, y + 4, 14, 4, '#ffffff'); break; }
      for (let k = 0; k < 6; k += 1) {
        const fx = x + 2 + ((k * 5 + seed) % 12);
        const fy = y + 3 + ((k * 3) % 5);
        rect(g, fx, fy + 1, 1, 3, '#3f8a43');
        disc(g, fx, fy, 1, P.flowers[(k + seed) % P.flowers.length]!);
      }
      break;
    }
    case 'pot': case 'plant': {
      shadow(g, x + 8, y + 15, 5);
      rect(g, x + 4, y + 9, 8, 6, '#c96a4c');
      rect(g, x + 4, y + 9, 8, 1, '#e08a6a');
      const leaf = p.tint ?? '#3f8a43';
      disc(g, x + 8, y + 4, 5, leaf);
      disc(g, x + 5, y + 6, 3, shade(leaf, 0.2));
      disc(g, x + 11, y + 2, 3, shade(leaf, -0.15));
      break;
    }
    case 'sunflowers': {
      for (let k = 0; k < 4; k += 1) {
        const sx = x + 2 + k * 4;
        const sy = y - 4 + (k % 2) * 3;
        const sway = Math.round(Math.sin(t * 1.5 + k) * 0.6);
        rect(g, sx, sy + 3, 1, 16 - (k % 2) * 3, '#4f8a3a');
        if (season === 'summer' || season === 'autumn') {
          disc(g, sx + sway, sy, 2, season === 'autumn' ? '#c9a024' : '#f6c14e');
          px(g, sx + sway, sy, '#6e4a2a');
        }
      }
      break;
    }
    case 'haystack': {
      shadow(g, x + 10, y + 15, 10);
      ellipse(g, x + 10, y + 8, 10, 8, snow ? '#ffffff' : '#d9b45a');
      ellipse(g, x + 8, y + 5, 5, 3, snow ? '#ffffff' : '#ecc96a');
      if (!snow) for (let k = 0; k < 8; k += 1) px(g, x + 3 + k * 2, y + 9 + (k % 3), '#b8943a');
      break;
    }
    case 'swing': {
      const ang = Math.sin(t * 2) * 3;
      rect(g, x, y - 12, 2, 28, '#c2494f');
      rect(g, x + 24, y - 12, 2, 28, '#c2494f');
      rect(g, x - 1, y - 13, 28, 2, '#e8b83a');
      for (const sx of [6, 16]) {
        rect(g, x + sx + ang, y - 11, 1, 18, '#5a5a64');
        rect(g, x + sx + 4 + ang, y - 11, 1, 18, '#5a5a64');
        rect(g, x + sx - 1 + ang, y + 7, 7, 2, '#8a5a34');
      }
      break;
    }
    case 'slide': {
      rect(g, x + 2, y - 10, 2, 24, '#5aa7e0');
      rect(g, x + 8, y - 10, 2, 24, '#5aa7e0');
      for (let k = 0; k < 5; k += 1) rect(g, x + 2, y - 8 + k * 4, 8, 1, '#3a6fd8');
      for (let k = 0; k < 14; k += 1) rect(g, x + 10 + k, y - 10 + k, 4, 2, '#f6c14e');
      break;
    }
    case 'sandbox': {
      rect(g, x, y, 32, 24, '#9a6a3a');
      rect(g, x + 2, y + 2, 28, 20, snow ? '#ffffff' : '#ecd69a');
      if (!snow) { rect(g, x + 8, y + 8, 4, 3, '#e8402e'); disc(g, x + 20, y + 14, 3, '#d9b45a'); }
      break;
    }
    case 'goal': {
      rect(g, x, y - 10, 2, 26, '#f4f4f7');
      rect(g, x, y - 10, 40, 2, '#f4f4f7');
      rect(g, x + 38, y - 10, 2, 26, '#f4f4f7');
      for (let k = 2; k < 38; k += 3) rect(g, x + k, y - 8, 1, 22, 'rgba(255,255,255,0.35)');
      break;
    }
    case 'flagpole': {
      rect(g, x + 7, y - 26, 2, 41, '#9a9aa4');
      const wave = Math.round(Math.sin(t * 3));
      rect(g, x + 9, y - 25 + wave, 12, 4, '#3f7fd8');
      rect(g, x + 9, y - 21 + wave, 12, 4, '#f6d24a');
      break;
    }
    case 'umbrella': {
      shadow(g, x + 8, y + 15, 10, 3);
      rect(g, x + 7, y - 6, 2, 21, '#8a6a4a');
      const c = p.tint ?? '#ff5d8f';
      for (let r = 0; r < 6; r += 1) {
        const w = 3 + r * 2;
        for (let k = -w; k <= w; k += 1) px(g, x + 8 + k, y - 12 + r, Math.floor((k + 20) / 3) % 2 ? c : '#fff4f8');
      }
      break;
    }
    case 'lounger': {
      rect(g, x, y + 6, 18, 4, p.tint ?? '#5aa7e0');
      rect(g, x, y + 2, 6, 6, p.tint ?? '#5aa7e0');
      rect(g, x + 1, y + 10, 1, 3, '#f4f4f7');
      rect(g, x + 16, y + 10, 1, 3, '#f4f4f7');
      break;
    }
    case 'yellowStone': {
      // Жовтий камінь на Отраді — серце історії.
      shadow(g, x + 18, y + 18, 20, 4);
      ellipse(g, x + 16, y + 10, 18, 9, '#c99a2a');
      ellipse(g, x + 15, y + 8, 16, 8, '#e6b93f');
      ellipse(g, x + 11, y + 5, 8, 4, '#f4d97e');
      rect(g, x + 22, y + 9, 6, 1, '#b8891f');
      rect(g, x + 4, y + 12, 9, 1, '#c99a2a');
      if (Math.floor(t * 2) % 2 === 0) px(g, x + 8, y + 3, '#ffffff');
      if (snow) ellipse(g, x + 13, y + 3, 9, 2, '#ffffff');
      break;
    }
    case 'boat': {
      const bob = Math.round(Math.sin(t * 1.8 + p.x));
      rect(g, x, y + 6 + bob, 28, 6, '#f4f4f7');
      rect(g, x + 2, y + 12 + bob, 24, 2, '#3a6fd8');
      rect(g, x + 13, y - 10 + bob, 1, 16, '#8a6a4a');
      for (let r = 0; r < 12; r += 1) rect(g, x + 14, y - 9 + r + bob, Math.round(r * 0.8), 1, '#fff4dc');
      break;
    }
    case 'lighthouse': {
      shadow(g, x + 10, y + 31, 10, 3);
      for (let r = 0; r < 34; r += 1) {
        const w = 6 + Math.round(r / 6);
        rect(g, x + 9 - w / 2, y - 4 + r, w, 1, Math.floor(r / 6) % 2 ? '#d9534f' : '#f8f4ec');
      }
      rect(g, x + 4, y - 12, 10, 8, '#3a3f4a');
      rect(g, x + 5, y - 11, 8, 5, '#ffe9a8');
      rect(g, x + 3, y - 15, 12, 3, '#d9534f');
      break;
    }
    case 'cafeTable': {
      shadow(g, x + 8, y + 15, 7);
      ellipse(g, x + 8, y + 7, 7, 3, '#f4f4f7');
      rect(g, x + 7, y + 8, 2, 7, '#5a5a64');
      rect(g, x + 1, y + 9, 3, 5, '#2f8a5a');
      rect(g, x + 12, y + 9, 3, 5, '#2f8a5a');
      px(g, x + 6, y + 6, '#8a5a34');
      px(g, x + 10, y + 6, '#f4f4f7');
      break;
    }
    case 'signpost': {
      rect(g, x + 7, y - 6, 2, 21, '#7a4a2a');
      rect(g, x + 1, y - 6, 14, 5, '#c08a52');
      rect(g, x + 15, y - 5, 2, 3, '#c08a52');
      rect(g, x + 3, y - 4, 9, 1, '#5a3a24');
      break;
    }
    case 'board': {
      shadow(g, x + 10, y + 15, 10);
      rect(g, x + 2, y - 8, 2, 23, '#7a4a2a');
      rect(g, x + 16, y - 8, 2, 23, '#7a4a2a');
      rect(g, x, y - 10, 20, 14, '#9a6a3a');
      rect(g, x + 1, y - 9, 18, 12, '#c9a46a');
      for (let k = 0; k < 4; k += 1) rect(g, x + 2 + (k % 2) * 9, y - 8 + Math.floor(k / 2) * 6, 7, 5, ['#f4f4f7', '#fff4b0', '#ffd7ec', '#d9f0fb'][k]!);
      break;
    }
    case 'bush': {
      shadow(g, x + 8, y + 15, 8);
      const leaf = snow ? '#5f7f6a' : P.leafDark;
      disc(g, x + 8, y + 9, 7, leaf);
      disc(g, x + 6, y + 7, 4, snow ? '#ffffff' : P.leaf);
      disc(g, x + 11, y + 8, 3, snow ? '#e9f0f8' : P.leafLight);
      if (season === 'summer') { px(g, x + 4, y + 10, '#e8402e'); px(g, x + 12, y + 11, '#e8402e'); }
      break;
    }
    case 'rock': {
      shadow(g, x + 8, y + 14, 7);
      ellipse(g, x + 8, y + 10, 7, 5, '#8a8478');
      ellipse(g, x + 6, y + 8, 3, 2, '#a8a294');
      if (snow) ellipse(g, x + 8, y + 6, 5, 2, '#ffffff');
      break;
    }
    case 'statue': {
      shadow(g, x + 8, y + 15, 8);
      rect(g, x + 2, y + 6, 12, 9, '#8a8478');
      rect(g, x + 2, y + 6, 12, 2, '#a8a294');
      rect(g, x + 6, y - 10, 4, 16, '#6a8a8a');
      disc(g, x + 8, y - 12, 2, '#6a8a8a');
      break;
    }
    case 'pier': {
      for (let k = 0; k < 4; k += 1) rect(g, x, y + k * 4, 32, 3, '#a8784a');
      rect(g, x, y, 32, 1, '#c89a6a');
      break;
    }
    case 'stairs': {
      for (let k = 0; k < 6; k += 1) rect(g, x, y + k * 5, 48, 4, k % 2 ? '#d8d0c2' : '#e8e0d0');
      break;
    }
    case 'chicken': {
      const walk = Math.sin(t * 1.3 + seed) * 10;
      const peck = Math.floor(t * 3 + seed) % 5 === 0 ? 1 : 0;
      const cx = x + 8 + Math.round(walk);
      shadow(g, cx, y + 14, 4, 1);
      ellipse(g, cx, y + 10, 4, 3, '#f8f4ec');
      disc(g, cx + 3, y + 7 + peck, 2, '#f8f4ec');
      px(g, cx + 4, y + 6 + peck, '#d9534f');
      px(g, cx + 5, y + 8 + peck, '#f6c14e');
      px(g, cx + 3, y + 7 + peck, '#2b2b33');
      rect(g, cx - 1, y + 13, 1, 2, '#f6c14e');
      rect(g, cx + 1, y + 13, 1, 2, '#f6c14e');
      break;
    }
    case 'cat': {
      // Кіт спить калачиком; хвіст ворушиться.
      const tail = Math.round(Math.sin(t * 2) * 1.5);
      ellipse(g, x + 8, y + 11, 6, 3, p.tint ?? '#e8a25a');
      disc(g, x + 13, y + 9, 3, p.tint ?? '#e8a25a');
      px(g, x + 12, y + 6, p.tint ?? '#e8a25a');
      px(g, x + 15, y + 6, p.tint ?? '#e8a25a');
      rect(g, x + 12, y + 9, 2, 1, '#5a3a24');
      rect(g, x + 1, y + 10 + tail, 3, 1, shade(p.tint ?? '#e8a25a', -0.2));
      for (let k = 0; k < 3; k += 1) px(g, x + 5 + k * 3, y + 10, shade(p.tint ?? '#e8a25a', -0.25));
      break;
    }
    case 'duck': {
      const swim = Math.sin(t * 0.6 + seed) * 14;
      const cx = x + 8 + Math.round(swim);
      const facing = Math.cos(t * 0.6 + seed) > 0 ? 1 : -1;
      ellipse(g, cx, y + 10, 4, 2, '#f8f4ec');
      disc(g, cx + 3 * facing, y + 7, 2, '#3f8a4a');
      px(g, cx + 5 * facing, y + 7, '#f6c14e');
      rect(g, cx - 4, y + 12, 9, 1, 'rgba(255,255,255,0.5)');
      break;
    }
    case 'gull': {
      const fx = x + ((t * 22 + seed) % 220) - 60;
      const fy = y + Math.sin(t * 1.4 + seed) * 6;
      const flap = Math.floor(t * 6) % 2;
      rect(g, fx, fy, 2, 1, '#f8f4ec');
      rect(g, fx - 3, fy - flap, 3, 1, '#c9ced8');
      rect(g, fx + 2, fy - flap, 3, 1, '#c9ced8');
      break;
    }
    case 'clock': {
      disc(g, x + 8, y + 6, 5, '#5a3a24');
      disc(g, x + 8, y + 6, 4, '#f8f4ec');
      rect(g, x + 8, y + 3, 1, 3, '#2b2b33');
      rect(g, x + 8, y + 6, 3, 1, '#2b2b33');
      break;
    }
    default:
      drawFurniture(g, p, x, y, t, season);
  }
}

// ------------------------------------------------------------
// Меблі кімнати.
// ------------------------------------------------------------
function drawFurniture(g: Ctx, p: Prop, x: number, y: number, t: number, season: Season): void {
  const tint = p.tint;
  const P = PALETTES[season];
  const snow = P.snow;
  switch (p.type) {
    case 'bed': {
      shadow(g, x + 9, y + 29, 10);
      rect(g, x, y, 16, 28, '#8a5a34');
      rect(g, x + 1, y + 1, 14, 6, '#f8f4ec');
      rect(g, x + 1, y + 7, 14, 19, tint ?? '#e98fb0');
      rect(g, x + 1, y + 7, 14, 2, shade(tint ?? '#e98fb0', 0.2));
      for (let k = 0; k < 3; k += 1) rect(g, x + 3 + k * 4, y + 13 + (k % 2) * 4, 2, 2, shade(tint ?? '#e98fb0', -0.15));
      rect(g, x, y + 26, 16, 2, '#6e4a2a');
      break;
    }
    case 'rug': {
      const c = tint ?? '#e98fb0';
      ellipse(g, x + 16, y + 8, 16, 7, shade(c, -0.15));
      ellipse(g, x + 16, y + 8, 14, 6, c);
      ellipse(g, x + 16, y + 8, 8, 3, shade(c, 0.2));
      break;
    }
    case 'floorLamp': {
      rect(g, x + 7, y - 4, 2, 18, '#3a3a40');
      rect(g, x + 4, y + 13, 8, 2, '#3a3a40');
      rect(g, x + 3, y - 9, 10, 6, tint ?? '#ffd27a');
      rect(g, x + 4, y - 9, 8, 1, shade(tint ?? '#ffd27a', 0.3));
      break;
    }
    case 'poster': {
      rect(g, x + 1, y + 2, 14, 10, '#f8f4ec');
      rect(g, x + 2, y + 3, 12, 8, tint ?? '#3f7fc1');
      rect(g, x + 2, y + 8, 12, 3, '#ecd69a');
      disc(g, x + 11, y + 5, 1, '#f6c14e');
      break;
    }
    case 'shelf': {
      rect(g, x, y - 10, 16, 24, tint ?? '#8a5a34');
      for (let r = 0; r < 3; r += 1) {
        rect(g, x + 1, y - 9 + r * 8, 14, 6, shade(tint ?? '#8a5a34', -0.3));
        for (let k = 0; k < 5; k += 1) rect(g, x + 2 + k * 3, y - 8 + r * 8, 2, 5, ['#b8323a', '#3a6fd8', '#f6c14e', '#7ed957', '#8a5ab5'][(k + r) % 5]!);
      }
      break;
    }
    case 'tv': {
      rect(g, x, y + 6, 16, 8, '#6e4a2a');
      rect(g, x + 1, y - 6, 14, 11, '#23232c');
      const glow = ['#6fc3e8', '#8ad6a0', '#e8a2c0'][Math.floor(t / 2) % 3]!;
      rect(g, x + 2, y - 5, 12, 8, glow);
      rect(g, x + 2, y - 5, 12, 2, shade(glow, 0.3));
      break;
    }
    case 'pet': {
      drawProp(g, { ...p, type: 'cat' }, 'summer', t);
      break;
    }
    case 'table': {
      shadow(g, x + 12, y + 15, 12);
      rect(g, x, y + 2, 24, 8, tint ?? '#c49a6c');
      rect(g, x, y + 2, 24, 2, shade(tint ?? '#c49a6c', 0.2));
      rect(g, x + 2, y + 10, 2, 5, '#6e4a2a');
      rect(g, x + 20, y + 10, 2, 5, '#6e4a2a');
      rect(g, x + 10, y, 4, 3, '#f8f4ec');
      px(g, x + 11, y - 1, '#ff7aa8');
      break;
    }
    case 'stove': {
      // Українська піч — біла, з комином.
      rect(g, x, y - 12, 16, 26, '#f6f1e6');
      rect(g, x, y - 12, 16, 2, '#ffffff');
      rect(g, x + 4, y + 2, 8, 7, '#3a2a24');
      rect(g, x + 5, y + 5, 6, 3, `rgba(255,${140 + Math.round(Math.sin(t * 6) * 40)},60,0.9)`);
      for (const [dx, dy] of [[3, -8], [11, -6], [6, -3]]) px(g, x + dx!, y + dy!, '#5aa7e0');
      break;
    }
    case 'window': {
      rect(g, x + 1, y + 1, 14, 12, '#8a5a34');
      rect(g, x + 2, y + 2, 12, 10, '#bfe3f5');
      rect(g, x + 7, y + 2, 1, 10, '#8a5a34');
      rect(g, x + 2, y + 6, 12, 1, '#8a5a34');
      rect(g, x + 2, y + 2, 3, 10, '#e98fb0');
      rect(g, x + 11, y + 2, 3, 10, '#e98fb0');
      break;
    }
    case 'rushnyk': {
      rect(g, x + 1, y + 2, 14, 2, '#8a5a34');
      rect(g, x + 2, y + 4, 3, 10, '#f8f4ec');
      rect(g, x + 11, y + 4, 3, 10, '#f8f4ec');
      for (let k = 0; k < 4; k += 1) { px(g, x + 3, y + 6 + k * 2, '#b8323a'); px(g, x + 12, y + 6 + k * 2, '#b8323a'); }
      break;
    }
    case 'wardrobe': {
      rect(g, x, y - 12, 16, 26, '#a8784a');
      rect(g, x, y - 12, 16, 2, '#c89a6a');
      rect(g, x + 7, y - 9, 1, 21, '#6e4a2a');
      px(g, x + 6, y, '#f6c14e');
      px(g, x + 9, y, '#f6c14e');
      break;
    }
    case 'desk': {
      rect(g, x, y + 2, 24, 7, '#a8784a');
      rect(g, x, y + 2, 24, 1, '#c89a6a');
      rect(g, x + 1, y + 9, 2, 5, '#6e4a2a');
      rect(g, x + 21, y + 9, 2, 5, '#6e4a2a');
      rect(g, x + 4, y - 2, 8, 5, '#f8f4ec');
      rect(g, x + 15, y - 4, 5, 6, '#3a3a40');
      break;
    }
    case 'sofa': {
      const c = tint ?? '#8a5ab5';
      rect(g, x, y, 30, 12, c);
      rect(g, x, y, 30, 4, shade(c, 0.2));
      rect(g, x - 1, y + 3, 4, 10, shade(c, -0.2));
      rect(g, x + 27, y + 3, 4, 10, shade(c, -0.2));
      rect(g, x + 6, y + 4, 6, 3, '#f6d55c');
      break;
    }
    case 'fridge': {
      rect(g, x + 1, y - 14, 14, 28, '#e9eef4');
      rect(g, x + 1, y - 4, 14, 1, '#b9c4d0');
      rect(g, x + 12, y - 10, 1, 4, '#9aa4b0');
      for (let k = 0; k < 3; k += 1) rect(g, x + 3 + k * 4, y - 12, 3, 3, ['#f6c14e', '#5aa7e0', '#ff7aa8'][k]!);
      break;
    }
    case 'woodpile': {
      // Дрова в повітці: торці полін рядами під дашком.
      shadow(g, x + 14, y + 15, 14);
      rect(g, x, y - 2, 28, 16, '#6e4a2a');
      for (let r = 0; r < 4; r += 1) {
        for (let k = 0; k < 7; k += 1) {
          const cx = x + 2 + k * 4 + (r % 2) * 2;
          const cy = y + 1 + r * 3;
          if (cx > x + 25) continue;
          disc(g, cx, cy, 1.6, '#c99a62');
          px(g, cx, cy, '#a87a48');
        }
      }
      rect(g, x - 1, y - 5, 30, 3, snow ? '#ffffff' : '#7d7a72');
      break;
    }
    case 'workbench': {
      // Верстак із лещатами й інструментом.
      shadow(g, x + 11, y + 15, 11);
      rect(g, x, y + 3, 22, 4, '#a8784a');
      rect(g, x, y + 3, 22, 1, '#c99a62');
      rect(g, x + 1, y + 7, 2, 8, '#7a5230');
      rect(g, x + 19, y + 7, 2, 8, '#7a5230');
      rect(g, x + 3, y + 1, 4, 2, '#5a6068');
      rect(g, x + 10, y + 1, 8, 1, '#8a8f96');
      rect(g, x + 15, y, 2, 2, '#b04a3a');
      if (snow) rect(g, x, y + 2, 22, 1, '#ffffff');
      break;
    }
    case 'planks': {
      // Дошки, складені біля стіни.
      for (let k = 0; k < 4; k += 1) rect(g, x, y + 4 + k * 2, 26, 2, k % 2 ? '#c99a62' : '#b0844e');
      rect(g, x + 3, y + 12, 3, 2, '#7a5230');
      rect(g, x + 20, y + 12, 3, 2, '#7a5230');
      break;
    }
    case 'cellar': {
      // Погріб: дерев'яна лядка в горбику, порослому травою.
      ellipse(g, x + 10, y + 10, 11, 6, snow ? '#ffffff' : P.grassDark);
      rect(g, x + 4, y + 6, 12, 8, '#7a5230');
      for (let k = 0; k < 12; k += 4) rect(g, x + 4 + k, y + 6, 1, 8, '#5a3a24');
      rect(g, x + 9, y + 9, 3, 2, '#3a3a40');
      break;
    }
    case 'door': {
      rect(g, x + 2, y - 8, 12, 22, '#8a5a34');
      rect(g, x + 3, y - 7, 10, 20, '#a8784a');
      px(g, x + 11, y + 3, '#f6c14e');
      break;
    }
    default:
      break;
  }
}
