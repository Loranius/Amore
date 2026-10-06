// ============================================================
// 2D-стиль: будівлі (ADR-0239). Та сама геометрія, що в піксельному
// стилі (`../buildings.ts`: висота стіни, дах, стик крил), — інше лише
// малювання: гладкі схили з черепицею, соломою чи бляхою, побілені стіни
// з призьбою, вікна з віконницями й квітами, двері на зріст людини.
// ============================================================
import type { Season } from '../../sim/calendar';
import { TILE, buildingParts, type Building, type Rect } from '../../world/types';
import { DOOR_H, STYLES, hasGable, joinOpts, wallOf, type Flush, type PartOpts, type StyleRule } from '../buildings';
import { PALETTES } from '../palette';
import { INK, LINE, box, circle, hash01, hires, line, lit, oval, poly, rr, shade, vgrad, type Ctx } from './kit';

export interface BuildingSprite2d {
  img: HTMLCanvasElement;
  ox: number;
  oy: number;
  /** Розмір у світових пікселях. */
  w: number;
  h: number;
  windows: Rect[];
  smoke: { x: number; y: number } | null;
}

const cache = new Map<string, BuildingSprite2d>();

export function buildingSprite2d(b: Building, season: Season, res: number): BuildingSprite2d {
  const n = b.notch;
  const key = `${b.id}|${b.style}|${b.x},${b.y},${b.w},${b.h}|${season}|${b.wall ?? ''}|${b.roof ?? ''}|${b.door === false ? 'nodoor' : b.doorX}|${n ? `${n.side}${n.w}x${n.h}` : ''}|${b.sideDoor ? 'side' : ''}|${b.join ?? ''}|${b.chimney === false ? 'nochim' : ''}|${hasGable(b) ? 'gable' : ''}|${res}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = n ? ell(b, season, res) : single(b, season, res);
  cache.set(key, sprite);
  return sprite;
}

interface Measure { W: number; Ht: number; roofBottom: number; rule: StyleRule }

function measure(b: Building, opts: PartOpts): Measure {
  const rule = STYLES[b.style];
  const W = b.w * TILE + 6;
  const roofBottom = rule.rise + Math.round(b.h * TILE * rule.roofFrac) + (opts.extraRoof ?? 0);
  const wallPx = opts.wallPx ?? wallOf(b.style, b.h);
  return { W, Ht: roofBottom + wallPx, roofBottom, rule };
}

function single(b: Building, season: Season, res: number): BuildingSprite2d {
  const opts = joinOpts(b);
  const m = measure(b, opts);
  const { c, g } = hires(m.W, m.Ht, res);
  const out = paintPart(g, b, season, opts, m);
  return { img: c, ox: -3, oy: -(m.Ht - b.h * TILE), w: m.W, h: m.Ht, windows: out.windows, smoke: out.smoke };
}

/** Г-подібна будівля з двох крил — як у піксельному стилі. */
function ell(b: Building, season: Season, res: number): BuildingSprite2d {
  const [tall, low] = buildingParts(b) as [Rect, Rect];
  const wallPx = wallOf(b.style, low.h);
  const side = b.notch!.side;
  const hasDoor = (r: Rect) => b.door !== false && b.doorX >= r.x && b.doorX < r.x + r.w;
  const rightEdge = (r: Rect) => !!b.sideDoor && r.x + r.w === b.x + b.w;
  const toLow: Flush = side === 'right' ? 'right' : 'left';
  const toTall: Flush = side === 'right' ? 'left' : 'right';
  const A = { ...b, ...tall, notch: undefined, door: hasDoor(tall), sideDoor: rightEdge(tall) };
  const B = { ...b, ...low, notch: undefined, door: hasDoor(low), sideDoor: rightEdge(low), gable: false };
  const optsA: PartOpts = { wallPx, flush: toLow, wallFlush: toLow, chimney: true };
  const optsB: PartOpts = { wallPx, flush: toTall, wallFlush: toTall, chimney: false };
  const mA = measure(A, optsA);
  const mB = measure(B, optsB);
  const W = b.w * TILE + 6;
  const Ht = mA.Ht;
  const { c, g } = hires(W, Ht, res);
  const ax = (tall.x - b.x) * TILE;
  const bx = (low.x - b.x) * TILE;
  const by = Ht - mB.Ht;
  // Нижче крило — спершу, вище — поверх: його дах перекриває стик.
  g.save();
  g.translate(bx, by);
  const outB = paintPart(g, B, season, optsB, mB);
  g.restore();
  g.save();
  g.translate(ax, 0);
  const outA = paintPart(g, A, season, optsA, mA);
  g.restore();
  const windows = [...outA.windows.map((w) => ({ ...w, x: w.x + ax })), ...outB.windows.map((w) => ({ ...w, x: w.x + bx, y: w.y + by }))];
  return { img: c, ox: -3, oy: -(Ht - b.h * TILE), w: W, h: Ht, windows, smoke: outA.smoke ? { x: outA.smoke.x + ax, y: outA.smoke.y } : null };
}

const CURTAINS = ['#f4b6c8', '#f6dd8a', '#b8e0c0', '#cfc2f2', '#fbf6ee'];

function paintPart(g: Ctx, b: Building, season: Season, opts: PartOpts, m: Measure): { windows: Rect[]; smoke: { x: number; y: number } | null } {
  const { W, Ht, roofBottom, rule } = m;
  const seed = hash01(b.x, b.y, b.w * 31 + b.h);
  const wallColor = b.wall ?? rule.wall;
  const roofColor = b.roof ?? rule.roofColor;
  const windows: Rect[] = [];
  const cottage = b.style === 'cottage';
  const wf = opts.wallFlush ?? null;
  const x0 = wf === 'left' ? 0 : 3;
  const x1 = wf === 'right' ? W : W - 3;
  const top = roofBottom - 2;

  // ── Стіна ──────────────────────────────────────────────
  g.save();
  g.beginPath();
  g.rect(x0, top, x1 - x0, Ht - top);
  g.clip();
  g.fillStyle = vgrad(g, top, Ht, shade(wallColor, 0.04), shade(wallColor, -0.07));
  g.fillRect(x0, top, x1 - x0, Ht - top);
  if (rule.material === 'wood') {
    for (let x = x0 + 2; x < x1; x += 4.5) {
      const k = Math.floor(x / 4.5);
      g.fillStyle = shade(wallColor, (hash01(k, b.x, 3) - 0.5) * 0.12);
      g.fillRect(x, top, 4.5, Ht - top);
      line(g, x, top, x, Ht, shade(wallColor, -0.35), 0.5);
      line(g, x + 0.8, top, x + 0.8, Ht, shade(wallColor, 0.12), 0.4);
    }
  } else if (rule.material === 'brick') {
    for (let y = top + 2; y < Ht; y += 4) line(g, x0, y, x1, y, shade(wallColor, -0.18), 0.4);
  }
  // Тінь від звису даху.
  g.fillStyle = vgrad(g, top, top + 6, 'rgba(50,30,40,0.32)', 'rgba(50,30,40,0)');
  g.fillRect(x0, top, x1 - x0, 6);
  // Знизу — темніше, земля бризкає на стіну.
  g.fillStyle = vgrad(g, Ht - 8, Ht, 'rgba(80,60,40,0)', 'rgba(80,60,40,0.16)');
  g.fillRect(x0, Ht - 8, x1 - x0, 8);
  g.restore();

  const wallTop = roofBottom + 3;
  const wallH = Ht - wallTop - 3;
  const doorCx = (b.doorX - b.x) * TILE + 8 + 3;
  const dw = b.style === 'barn' ? 18 : 12;
  const dh = Math.min(DOOR_H, wallH - 4);
  const doorHalf = dw / 2 + 3;

  // Хата: орнамент під стріхою й призьба.
  if (cottage) {
    for (let x = x0 + 3; x < x1 - 3; x += 6) {
      poly(g, [[x, wallTop + 1], [x + 2, wallTop - 1], [x + 4, wallTop + 1], [x + 2, wallTop + 3]], '#c2493a', null);
      circle(g, x + 5, wallTop + 1, 0.6, '#3a3550', null);
    }
    box(g, x0 - (wf === 'left' ? 1 : 0), Ht - 6.5, x1 - x0 + (wf ? 1 : 0), 6.5, [2, 2, 0, 0], vgrad(g, Ht - 6.5, Ht, '#8ea3c8', '#5f76a0'), null);
    line(g, x0, Ht - 6.5, x1, Ht - 6.5, '#b9c8e2', 0.6);
  }

  // ── Вікна ──────────────────────────────────────────────
  const farm = b.style === 'barn' || b.style === 'coop' || b.style === 'shed';
  if (farm) {
    windowAt(g, 7, wallTop + 4, 8, 7, rule.frame, seed, false, false, season, windows);
  } else {
    const ww = 10;
    const wh = 12;
    const gap = cottage ? 18 : 12;
    const y = wallTop + Math.max(2, Math.floor((wallH - wh) / 2) - 2);
    for (let x = 8; x + ww <= W - 8; x += ww + gap) {
      if (b.door !== false && x + ww > doorCx - doorHalf - 2 && x < doorCx + doorHalf + 2) continue;
      if (b.sideDoor && x + ww > W - 18) continue;
      windowAt(g, x, y, ww, wh, rule.frame, seed + x, cottage, true, season, windows);
    }
  }

  // ── Двері ──────────────────────────────────────────────
  if (b.door !== false) doorAt(g, doorCx - dw / 2, Ht - 1.5, dw, dh, b.style === 'barn');
  if (b.sideDoor) {
    const sh = Math.min(DOOR_H, wallH - 4);
    box(g, W - 10, Ht - sh - 2, 7, sh + 1, [3, 3, 0, 0], lit(g, W - 10, Ht - sh, 7, sh, '#9a6a3e'));
    line(g, W - 6.5, Ht - sh, W - 6.5, Ht - 2, '#6e4a2a', 0.5);
    circle(g, W - 8.6, Ht - sh / 2 - 2, 0.7, '#f2c14e', null);
    // Козирок на стовпчику.
    box(g, W - 14, Ht - sh - 7, 14, 3, 1, lit(g, W - 14, Ht - sh - 7, 14, 3, shade(roofColor, -0.1)));
    line(g, W - 1.5, Ht - sh - 4, W - 1.5, Ht - 1, '#6e4a2a', 1.2);
  }

  // ── Дах ────────────────────────────────────────────────
  if (hasGable(b)) gableRoof(g, W, rule, roofColor, roofBottom, cottage ? '#d9b98c' : wallColor, cottage, rule.frame, season, windows, opts.flush ?? null);
  else ridgeRoof(g, W, rule, roofColor, roofBottom, season, opts.flush ?? null);

  // Обвідка стіни (крім боку стику).
  g.strokeStyle = INK;
  g.lineWidth = LINE;
  g.beginPath();
  if (wf !== 'left') { g.moveTo(x0, top + 2); g.lineTo(x0, Ht); } else g.moveTo(x0, Ht);
  g.lineTo(x1, Ht);
  if (wf !== 'right') g.lineTo(x1, top + 2);
  g.stroke();

  // Комин.
  let smoke: { x: number; y: number } | null = null;
  if (rule.chimney && opts.chimney !== false) {
    const cx = W - 16;
    const ct = rule.rise + 2;
    box(g, cx, ct - 8, 6, 12, 1, lit(g, cx, ct - 8, 6, 12, '#a8604a'));
    for (let r = 0; r < 10; r += 3.4) line(g, cx + 0.5, ct - 6 + r, cx + 5.5, ct - 6 + r, 'rgba(70,30,20,0.4)', 0.4);
    box(g, cx - 1, ct - 10, 8, 2.6, 1, '#7a4a3a');
    if (season === 'winter') box(g, cx - 1.2, ct - 11.2, 8.4, 1.8, 0.9, '#ffffff', null);
    smoke = { x: cx + 3, y: ct - 10 };
  }
  return { windows, smoke };
}

/** Дах із гребенем уздовж фасаду: задній схил (світліший) і передній. */
function ridgeRoof(g: Ctx, W: number, rule: StyleRule, color: string, bottom: number, season: Season, flush: Flush): void {
  const topY = rule.rise;
  const ridge = topY + (bottom - topY) * 0.3;
  const l = flush === 'left' ? -0.5 : 0;
  const r = flush === 'right' ? W + 0.5 : W;
  const ins = (v: number, side: 'l' | 'r') => ((side === 'l' ? flush === 'left' : flush === 'right') ? 0 : v);
  // Задній схил.
  poly(g, [[l + ins(3, 'l'), topY], [r - ins(3, 'r'), topY], [r - ins(1, 'r'), ridge], [l + ins(1, 'l'), ridge]], lit(g, 0, topY, W, ridge - topY, shade(color, 0.14)));
  // Передній схил.
  const front: [number, number][] = [[l + ins(1, 'l'), ridge], [r - ins(1, 'r'), ridge], [r, bottom + 2], [l, bottom + 2]];
  poly(g, front, vgrad(g, ridge, bottom + 2, shade(color, 0.04), shade(color, -0.14)));
  g.save();
  g.beginPath();
  front.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.clip();
  roofTexture(g, rule.roof, color, l, ridge, r - l, bottom + 2 - ridge, 'rows');
  if (season === 'winter') snowCap(g, l, ridge, r - l, bottom + 2 - ridge);
  g.restore();
  line(g, l + ins(1, 'l'), ridge, r - ins(1, 'r'), ridge, shade(color, -0.4), 1);
  line(g, l + 1, bottom + 1.2, r - 1, bottom + 1.2, shade(color, -0.45), 1.4);
}

/** Дах із фронтоном до глядача: два схили, гребінь углиб, трикутна стіна горища з віконцем. */
function gableRoof(g: Ctx, W: number, rule: StyleRule, color: string, bottom: number, gableColor: string, boards: boolean, frame: string, season: Season, windows: Rect[], flush: Flush): void {
  const topY = rule.rise;
  const cx = W / 2;
  const apex = topY + (bottom - topY) * 0.22;
  const l = flush === 'left' ? -0.5 : 0;
  const r = flush === 'right' ? W + 0.5 : W;
  const left: [number, number][] = [[l, topY], [cx, topY], [cx, apex], [l, bottom + 2]];
  const right: [number, number][] = [[cx, topY], [r, topY], [r, bottom + 2], [cx, apex]];
  poly(g, left, lit(g, 0, topY, cx, bottom - topY, shade(color, 0.08)));
  poly(g, right, vgrad(g, topY, bottom, shade(color, -0.12), shade(color, -0.22)));
  for (const [pts, x, w] of [[left, l, cx - l], [right, cx, r - cx]] as const) {
    g.save();
    g.beginPath();
    pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.clip();
    roofTexture(g, rule.roof, color, x, topY, w, bottom + 2 - topY, 'cols');
    if (season === 'winter') snowCap(g, x, topY, w, bottom - topY);
    g.restore();
  }
  line(g, cx, topY, cx, apex, shade(color, 0.3), 1.2);
  // Фронтон.
  const gl = 4;
  const tri: [number, number][] = [[gl, bottom + 0.5], [cx, apex + 2.5], [W - gl, bottom + 0.5]];
  poly(g, tri, vgrad(g, apex, bottom, shade(gableColor, 0.06), shade(gableColor, -0.08)), null);
  if (boards) {
    g.save();
    g.beginPath();
    tri.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.clip();
    for (let x = gl; x < W - gl; x += 3.6) line(g, x, apex, x, bottom, shade(gableColor, -0.2), 0.45);
    g.restore();
  }
  // Лиштва вздовж схилів — світла дошка з темним краєм.
  for (const [ex, ey] of [[1.5, bottom + 2], [W - 1.5, bottom + 2]] as const) {
    line(g, ex, ey, cx, apex, shade(color, -0.5), 3.4);
    line(g, ex, ey, cx, apex, shade(gableColor, 0.3), 1.8);
  }
  circle(g, cx, apex + 0.5, 1.6, shade(gableColor, 0.3));
  // Віконце горища.
  const half = (W - 2 * gl) / 2;
  const gh = bottom - apex;
  if (gh > 12 && half > 10) {
    const wy = bottom - gh * 0.6;
    box(g, cx - 5, wy - 1, 10, 10, [5, 5, 1, 1], frame);
    box(g, cx - 3.8, wy + 0.2, 7.6, 7.6, [3.8, 3.8, 0.6, 0.6], vgrad(g, wy, wy + 8, '#4a3e66', '#2e2640'), null);
    line(g, cx, wy, cx, wy + 8, frame, 0.8);
    line(g, cx - 3.8, wy + 4.5, cx + 3.8, wy + 4.5, frame, 0.8);
    line(g, cx - 2.6, wy + 1.4, cx - 1, wy + 3, 'rgba(255,255,255,0.45)', 0.6);
    windows.push({ x: cx - 4, y: wy, w: 8, h: 8 });
  }
}

/** Фактура покрівлі: черепиця лусками, солома пасмами, бляха ребрами. */
function roofTexture(g: Ctx, kind: StyleRule['roof'], color: string, x: number, y: number, w: number, h: number, dir: 'rows' | 'cols'): void {
  const dark = shade(color, -0.3);
  const light = shade(color, 0.22);
  if (kind === 'tile') {
    if (dir === 'rows') {
      for (let ry = y + 3; ry < y + h + 3; ry += 4) {
        const off = Math.round((ry - y) / 4) % 2 ? 2.5 : 0;
        for (let rx = x - 5 + off; rx < x + w + 5; rx += 5) {
          g.beginPath();
          g.arc(rx + 2.5, ry - 1, 2.5, 0.1, Math.PI - 0.1);
          g.strokeStyle = dark;
          g.lineWidth = 0.55;
          g.stroke();
        }
        line(g, x, ry - 3.4, x + w, ry - 3.4, light, 0.35);
      }
    } else {
      for (let rx = x + 2; rx < x + w; rx += 4) line(g, rx, y, rx, y + h, dark, 0.55);
      for (let ry = y + 3; ry < y + h; ry += 5) line(g, x, ry, x + w, ry, 'rgba(0,0,0,0.12)', 0.4);
    }
  } else if (kind === 'thatch') {
    for (let k = 0; k < (w * h) / 5; k += 1) {
      const sx = x + hash01(k, Math.round(w), 7) * w;
      const sy = y + hash01(k, Math.round(h), 8) * h;
      if (dir === 'rows') line(g, sx, sy, sx + 0.8, sy + 3.2, k % 3 ? dark : light, 0.5);
      else line(g, sx, sy, sx + 3.4, sy + 0.9, k % 3 ? dark : light, 0.5);
    }
    // Шари солом'яної стріхи.
    if (dir === 'rows') for (let ry = y + 5; ry < y + h; ry += 6) line(g, x, ry, x + w, ry, 'rgba(70,40,10,0.25)', 0.8);
    else for (let rx = x + 5; rx < x + w; rx += 6) line(g, rx, y, rx, y + h, 'rgba(70,40,10,0.22)', 0.8);
  } else if (kind === 'metal') {
    if (dir === 'rows') for (let rx = x + 2; rx < x + w; rx += 3.5) line(g, rx, y, rx, y + h, dark, 0.5);
    else for (let ry = y + 2; ry < y + h; ry += 3.5) line(g, x, ry, x + w, ry, dark, 0.5);
    line(g, x + 2, y + 1, x + w * 0.5, y + 1, light, 0.5);
  }
}

function snowCap(g: Ctx, x: number, y: number, w: number, h: number): void {
  g.fillStyle = 'rgba(255,255,255,0.88)';
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  for (let k = 0; k <= 8; k += 1) g.lineTo(x + w - (w * k) / 8, y + h * 0.72 + Math.sin(k * 1.7) * 1.4);
  g.closePath();
  g.fill();
}

function windowAt(g: Ctx, x: number, y: number, w: number, h: number, frame: string, seed: number, shutters: boolean, flowers: boolean, season: Season, out: Rect[]): void {
  // Лиштва (хата — розписне півколо над вікном).
  if (shutters) {
    g.beginPath();
    g.ellipse(x + w / 2, y - 1, w / 2 + 2, 2.8, 0, Math.PI, 0);
    g.fillStyle = '#c2493a';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.5;
    g.stroke();
  }
  box(g, x - 1, y - 1, w + 2, h + 2, 1.2, frame);
  box(g, x + 0.2, y + 0.2, w - 0.4, h - 0.4, 0.8, vgrad(g, y, y + h, '#bfe2f4', '#6f9cc8'), null);
  // Фіранки.
  const cur = CURTAINS[Math.floor(seed * 997) % CURTAINS.length]!;
  g.fillStyle = cur;
  g.beginPath();
  g.moveTo(x + 0.2, y + 0.2);
  g.quadraticCurveTo(x + w * 0.38, y + h * 0.3, x + 1.2, y + h - 0.2);
  g.lineTo(x + 0.2, y + h - 0.2);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(x + w - 0.2, y + 0.2);
  g.quadraticCurveTo(x + w * 0.62, y + h * 0.3, x + w - 1.2, y + h - 0.2);
  g.lineTo(x + w - 0.2, y + h - 0.2);
  g.closePath();
  g.fill();
  line(g, x + w / 2, y, x + w / 2, y + h, frame, 0.8);
  line(g, x, y + h * 0.42, x + w, y + h * 0.42, frame, 0.8);
  line(g, x + w * 0.2, y + h * 0.15, x + w * 0.4, y + h * 0.05, 'rgba(255,255,255,0.7)', 0.6);
  if (shutters) {
    for (const sx of [x - 4.6, x + w + 1]) {
      box(g, sx, y - 0.6, 3.6, h + 1.2, 0.8, lit(g, sx, y, 3.6, h, '#4f7fc0'));
      circle(g, sx + 1.8, y + h / 2, 0.7, '#f6dd8a', null);
    }
  }
  if (flowers && season !== 'winter') {
    box(g, x - 1.5, y + h + 1.2, w + 3, 2.6, 0.8, lit(g, x, y + h, w, 3, '#9a6a3e'));
    const P = PALETTES[season];
    for (let k = 0; k < 4; k += 1) {
      const fx = x + 0.5 + k * (w / 3.4);
      circle(g, fx, y + h + 0.6, 1.25, P.flowers[(k + Math.floor(seed * 13)) % P.flowers.length]!, shade(P.flowers[(k + Math.floor(seed * 13)) % P.flowers.length]!, -0.4), 0.35);
      oval(g, fx + 1, y + h + 1.4, 0.9, 0.5, '#4f9a3e', null);
    }
  }
  out.push({ x, y, w, h });
}

function doorAt(g: Ctx, x: number, bottom: number, w: number, h: number, barn: boolean): void {
  const y = bottom - h;
  // Приступок.
  box(g, x - 2, bottom - 1.2, w + 4, 2.4, 1, '#b8ad9c');
  box(g, x, y, w, h, barn ? 1 : ([w / 2, w / 2, 0, 0]), lit(g, x, y, w, h, barn ? '#8a6040' : '#a8723e'));
  g.save();
  rr(g, x, y, w, h, barn ? 1 : [w / 2, w / 2, 0, 0]);
  g.clip();
  for (let k = x + 3; k < x + w; k += 3) line(g, k, y, k, bottom, 'rgba(60,30,10,0.35)', 0.45);
  if (barn) {
    line(g, x + w / 2, y, x + w / 2, bottom, '#5a3a24', 0.9);
    line(g, x + 1, bottom - 1, x + w / 2 - 1, y + 2, '#6e4a2a', 1.2);
    line(g, x + w - 1, bottom - 1, x + w / 2 + 1, y + 2, '#6e4a2a', 1.2);
  }
  g.restore();
  if (!barn) circle(g, x + w - 2.8, y + h * 0.58, 0.8, '#f2c14e', shade('#f2c14e', -0.5), 0.3);
}

/** Тінь будинку на землі — м'яка, вправо-вниз (сонце зліва вгорі). */
export function drawBuildingShadow2d(g: Ctx, b: Building): void {
  if (b.notch) {
    for (const r of buildingParts(b)) drawBuildingShadow2d(g, { ...b, ...r, notch: undefined });
    return;
  }
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const gr = g.createLinearGradient(x + w, 0, x + w + 12, 0);
  gr.addColorStop(0, 'rgba(40,26,46,0.24)');
  gr.addColorStop(1, 'rgba(40,26,46,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x + w, y + 6);
  g.lineTo(x + w + 12, y + 16);
  g.lineTo(x + w + 12, y + h + 6);
  g.lineTo(x + w, y + h);
  g.closePath();
  g.fill();
  const gb = g.createLinearGradient(0, y + h, 0, y + h + 7);
  gb.addColorStop(0, 'rgba(40,26,46,0.22)');
  gb.addColorStop(1, 'rgba(40,26,46,0)');
  g.fillStyle = gb;
  g.fillRect(x + 2, y + h, w + 8, 7);
}
