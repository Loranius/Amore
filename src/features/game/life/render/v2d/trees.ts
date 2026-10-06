// ============================================================
// 2D-стиль: дерева (ADR-0239). Крона — купа м'яких куль у три тони
// (тінь, листя, світло зверху-зліва), стовбур звужується догори й має
// корені біля землі. Яблука, вишні, цвіт — за порою року.
// ============================================================
import type { Season } from '../../sim/calendar';
import type { Tree, TreeKind } from '../../world/types';
import { PALETTES } from '../palette';
import { INK, circle, hash01, hires, lit, oval, shade, type Ctx } from './kit';

export interface TreeSprite2d { img: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }

const TW = 48;
const TH = 60;
const AX = 24;
const AY = 56;
const cache = new Map<string, TreeSprite2d>();

export function treeSprite2d(tree: Tree, season: Season, res: number): TreeSprite2d {
  const variant = Math.floor(hash01(Math.round(tree.x * 7), Math.round(tree.y * 7), 3) * 3);
  const key = `${tree.kind}|${season}|${variant}|${res}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { c, g } = hires(TW, TH, res);
  paintTree(g, tree.kind, season, variant);
  const s = { img: c, w: TW, h: TH, ax: AX, ay: AY };
  cache.set(key, s);
  return s;
}

type Blob = [number, number, number];

function paintTree(g: Ctx, kind: TreeKind, season: Season, variant: number): void {
  const P = PALETTES[season];
  const bark = kind === 'birch' ? '#e9e4da' : kind === 'pine' ? '#6a4a32' : '#7a5236';
  if (kind === 'pine') {
    trunk(g, bark, 14, 3);
    const tiers: [number, number, number][] = [[44, 15, 12], [35, 12, 11], [26, 9.5, 10], [18, 7, 9], [11, 4, 7]];
    for (const [base, half, hgt] of tiers) {
      g.beginPath();
      g.moveTo(AX - half, base);
      g.quadraticCurveTo(AX, base + 3, AX + half, base);
      g.lineTo(AX, base - hgt);
      g.closePath();
      g.fillStyle = lit(g, AX - half, base - hgt, half * 2, hgt, P.snow ? '#3f6a4c' : '#3f7a46');
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.7;
      g.stroke();
      if (P.snow) oval(g, AX - half * 0.2, base - hgt * 0.45, half * 0.55, 1.6, '#ffffff', null);
    }
    return;
  }
  const crownBase = kind === 'willow' ? 30 : kind === 'poplar' ? 46 : 34;
  trunk(g, bark, crownBase, kind === 'poplar' ? 2.6 : 3.4);
  if (kind === 'birch') for (let y = crownBase + 3; y < AY - 3; y += 4) oval(g, AX - 0.5 + (y % 3) * 0.6, y, 1.2, 0.5, '#2b2b2b', null);

  let blobs: Blob[];
  if (kind === 'poplar') blobs = [[24, 44, 7], [24, 35, 8], [24, 26, 7.5], [24, 17, 6.5], [24, 10, 4.5]];
  else if (kind === 'willow') blobs = [[24, 22, 12], [13, 27, 7], [35, 27, 7], [24, 13, 8]];
  else if (kind === 'birch') blobs = [[24, 20, 9], [16, 26, 7], [32, 25, 7], [24, 11, 6]];
  else blobs = variant === 0
    ? [[24, 22, 11], [14, 28, 8], [34, 28, 8], [18, 14, 8], [30, 15, 7.5]]
    : variant === 1
      ? [[24, 21, 12], [13, 29, 7], [35, 27, 8], [24, 10, 7]]
      : [[23, 23, 11], [33, 20, 9], [14, 18, 8], [25, 11, 7]];

  if (P.snow) {
    bareBranches(g, bark, crownBase);
    for (const [x, y, r] of blobs.slice(0, 3)) oval(g, x, y - r * 0.4, r * 0.55, 1.4, '#ffffff', null);
    return;
  }
  let dark = P.leafDark;
  let mid = P.leaf;
  let light = P.leafLight;
  if (season === 'autumn' && (kind === 'birch' || variant === 2)) { dark = '#c9902a'; mid = '#e8b83a'; light = '#f6d86a'; }
  if (season === 'autumn' && kind === 'chestnut') { dark = '#9a4a20'; mid = '#c96a2a'; light = '#e8964a'; }

  // Тінь крони — суцільний силует з обвідкою.
  for (const [x, y, r] of blobs) circle(g, x, y, r, dark, INK, 0.8);
  for (const [x, y, r] of blobs) circle(g, x, y, r - 0.4, dark, null);
  // Листя — трохи вище й лівіше.
  for (const [x, y, r] of blobs) circle(g, x - r * 0.12, y - r * 0.16, r * 0.82, mid, null);
  // Світло зверху-зліва.
  for (const [x, y, r] of blobs) circle(g, x - r * 0.32, y - r * 0.38, r * 0.42, light, null);
  // Дрібні листочки по краю — силует не кулястий.
  for (let k = 0; k < 14; k += 1) {
    const [bx, by, br] = blobs[k % blobs.length]!;
    const a = hash01(k, variant, 4) * Math.PI * 2;
    oval(g, bx + Math.cos(a) * br * 0.75, by + Math.sin(a) * br * 0.75, 1.6, 1, k % 2 ? light : mid, null, 0, a);
  }
  if (kind === 'willow') {
    for (let x = 9; x < 40; x += 2.4) {
      const len = 9 + hash01(Math.round(x * 3), variant, 5) * 9;
      g.beginPath();
      g.moveTo(x, 26);
      g.quadraticCurveTo(x + 1.5, 26 + len * 0.5, x + 0.5, 26 + len);
      g.strokeStyle = Math.round(x) % 2 ? light : mid;
      g.lineWidth = 1;
      g.stroke();
    }
  }
  const dots = (color: string, n: number, r: number) => {
    for (let k = 0; k < n; k += 1) {
      const [bx, by, br] = blobs[k % blobs.length]!;
      const a = hash01(k, variant, 9) * Math.PI * 2;
      const d = hash01(k, variant, 10) * br * 0.75;
      const x = bx + Math.cos(a) * d;
      const y = by + Math.sin(a) * d;
      circle(g, x, y, r, color, shade(color, -0.45), 0.35);
      circle(g, x - r * 0.35, y - r * 0.35, r * 0.35, 'rgba(255,255,255,0.7)', null);
    }
  };
  if (season === 'spring' && kind === 'cherry') dots('#ffc8de', 26, 1.2);
  if (season === 'spring' && kind === 'apple') dots('#fff4f8', 20, 1.1);
  if (season === 'summer' && kind === 'cherry') dots('#c2283a', 12, 1.1);
  if ((season === 'summer' || season === 'autumn') && kind === 'apple') dots('#e2402e', 10, 1.6);
}

function trunk(g: Ctx, bark: string, top: number, half: number): void {
  g.beginPath();
  g.moveTo(AX - half - 3, AY);
  g.quadraticCurveTo(AX - half, AY - 2, AX - half * 0.8, AY - 6);
  g.lineTo(AX - half * 0.55, top);
  g.lineTo(AX + half * 0.55, top);
  g.lineTo(AX + half * 0.8, AY - 6);
  g.quadraticCurveTo(AX + half, AY - 2, AX + half + 3, AY);
  g.closePath();
  g.fillStyle = lit(g, AX - half, top, half * 2, AY - top, bark);
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.75;
  g.stroke();
  g.strokeStyle = shade(bark, -0.3);
  g.lineWidth = 0.45;
  for (let y = top + 4; y < AY - 4; y += 5) {
    g.beginPath();
    g.moveTo(AX - 0.6, y);
    g.lineTo(AX + 0.4, y + 2);
    g.stroke();
  }
}

function bareBranches(g: Ctx, bark: string, top: number): void {
  g.strokeStyle = bark;
  g.lineCap = 'round';
  for (const [dx, dy, w] of [[-12, -16, 1.8], [11, -14, 1.8], [-5, -24, 1.4], [6, -22, 1.4], [-16, -8, 1.2], [15, -6, 1.2]] as const) {
    g.beginPath();
    g.moveTo(AX, top + 4);
    g.quadraticCurveTo(AX + dx * 0.3, top + dy * 0.5, AX + dx, top + dy);
    g.lineWidth = w;
    g.stroke();
  }
}

/** Тінь дерева — м'який овал, зсунутий праворуч. */
export function drawTreeShadow2d(g: Ctx, x: number, y: number, kind: TreeKind): void {
  const w = kind === 'pine' || kind === 'poplar' ? 10 : 16;
  const gr = g.createRadialGradient(x + 4, y - 1, 0, x + 4, y - 1, w);
  gr.addColorStop(0, 'rgba(40,26,46,0.3)');
  gr.addColorStop(1, 'rgba(40,26,46,0)');
  g.save();
  g.translate(x + 4, y - 1);
  g.scale(1, 0.32);
  g.translate(-(x + 4), -(y - 1));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x + 4, y - 1, w, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
