// ============================================================
// Будинки «Дєвочка в городі» (ADR-0239) у ракурсі «три чверті»: дах, що
// звужується догори рядами черепиці, фасад із фактурою, вікна з
// рамами й фіранками, двері з ґанком, вивіска з піктограмою.
// Узимку на дахах сніг і бурульки; вночі вікна світяться (`windows`).
// ============================================================
import type { Season } from '../sim/calendar';
import { TILE, buildingParts, type Building, type BuildingStyle, type Rect } from '../world/types';
import { bitmapSize, drawBitmap } from './icons';
import { canvas, cellHash, ctx2d, disc, disciplinePalette, ellipse, mix, px, rect, shade, type Ctx } from './pixel';

export interface BuildingSprite {
  img: HTMLCanvasElement;
  /** Зсув спрайта від лівого верхнього кута сліду будинку (пікселі). */
  ox: number;
  oy: number;
  /** Вікна у координатах спрайта — світяться вночі. */
  windows: Rect[];
  /** Димар — звідки йде дим (координати спрайта). */
  smoke: { x: number; y: number } | null;
}

type Material = 'plaster' | 'brick' | 'wood' | 'panel' | 'glass' | 'stone';
type RoofKind = 'thatch' | 'tile' | 'flat' | 'metal' | 'none';
type Flush = 'left' | 'right' | null;

interface StyleRule {
  rise: number;
  roof: RoofKind;
  roofFrac: number;
  material: Material;
  wall: string;
  roofColor: string;
  frame: string;
  window: 'small' | 'tall' | 'shop' | 'grid' | 'curtain' | 'arch';
  chimney?: boolean;
  awning?: boolean;
}

const STYLES: Record<BuildingStyle, StyleRule> = {
  cottage: { rise: 14, roof: 'thatch', roofFrac: 0.48, material: 'plaster', wall: '#f6f1e6', roofColor: '#c9a25a', frame: '#3f6fb0', window: 'small', chimney: true },
  house: { rise: 14, roof: 'tile', roofFrac: 0.45, material: 'plaster', wall: '#f0e2c0', roofColor: '#b0563c', frame: '#f4f4f7', window: 'small', chimney: true },
  sadok: { rise: 12, roof: 'tile', roofFrac: 0.4, material: 'plaster', wall: '#fbe3a8', roofColor: '#e0703c', frame: '#5aa7e0', window: 'small' },
  school: { rise: 16, roof: 'metal', roofFrac: 0.34, material: 'brick', wall: '#d9a46a', roofColor: '#4a7fb5', frame: '#f4f4f7', window: 'tall' },
  lyceum: { rise: 16, roof: 'metal', roofFrac: 0.32, material: 'plaster', wall: '#e3dccb', roofColor: '#5560a8', frame: '#f4f4f7', window: 'tall' },
  shop: { rise: 8, roof: 'flat', roofFrac: 0.2, material: 'brick', wall: '#c98f6a', roofColor: '#6e5a52', frame: '#3a2f28', window: 'shop', awning: true },
  cafe: { rise: 8, roof: 'flat', roofFrac: 0.2, material: 'wood', wall: '#8a5a34', roofColor: '#5a3a24', frame: '#2b2018', window: 'shop', awning: true },
  kiosk: { rise: 6, roof: 'flat', roofFrac: 0.22, material: 'panel', wall: '#d9e3ea', roofColor: '#4a7fb5', frame: '#4a7fb5', window: 'shop', awning: true },
  block: { rise: 6, roof: 'flat', roofFrac: 0.08, material: 'panel', wall: '#d8d2c6', roofColor: '#8a8580', frame: '#f4f4f7', window: 'grid' },
  office: { rise: 4, roof: 'flat', roofFrac: 0.06, material: 'glass', wall: '#6f8fae', roofColor: '#4a5a6e', frame: '#c9d6e3', window: 'curtain' },
  station: { rise: 20, roof: 'metal', roofFrac: 0.3, material: 'stone', wall: '#efe2c2', roofColor: '#4a8f7a', frame: '#f4f4f7', window: 'arch' },
  busStation: { rise: 8, roof: 'flat', roofFrac: 0.2, material: 'panel', wall: '#e6e1d3', roofColor: '#3a6fd8', frame: '#3a6fd8', window: 'shop' },
  uni: { rise: 20, roof: 'metal', roofFrac: 0.28, material: 'stone', wall: '#e8dcc0', roofColor: '#3f6fb0', frame: '#f4f4f7', window: 'tall' },
  post: { rise: 10, roof: 'tile', roofFrac: 0.38, material: 'plaster', wall: '#e9e4d6', roofColor: '#4a7fb5', frame: '#f6c14e', window: 'small' },
  lavra: { rise: 40, roof: 'metal', roofFrac: 0.2, material: 'plaster', wall: '#f8f6f0', roofColor: '#3f8a6a', frame: '#c9a24a', window: 'arch' },
  church: { rise: 34, roof: 'metal', roofFrac: 0.22, material: 'plaster', wall: '#f8f6f0', roofColor: '#3f6fb0', frame: '#c9a24a', window: 'arch' },
  ratusha: { rise: 46, roof: 'metal', roofFrac: 0.24, material: 'stone', wall: '#e8d8b8', roofColor: '#4a8f7a', frame: '#f4f4f7', window: 'arch' },
  // Садиба (2026-10-06): старі сільські господарські будівлі — дошка, шифер.
  barn: { rise: 12, roof: 'tile', roofFrac: 0.52, material: 'wood', wall: '#8f6e4a', roofColor: '#7d7a72', frame: '#5a4030', window: 'small' },
  coop: { rise: 8, roof: 'tile', roofFrac: 0.5, material: 'wood', wall: '#a8845a', roofColor: '#9a5a3c', frame: '#5a4030', window: 'small' },
  shed: { rise: 10, roof: 'metal', roofFrac: 0.45, material: 'wood', wall: '#9c7a52', roofColor: '#6e7a82', frame: '#5a4030', window: 'small' },
};

/**
 * Найменша висота стіни фасаду (px). Лєна-доросла — 31 px, тож поверх має
 * бути помітно вищим за неї, а двері — з її зріст (власник, 2026-10-05:
 * «будинки набагато менші, ніж вона, двері менші за персонажів»). Раніше
 * стіна бралася лише з глибини сліду, і низька хата мала стіну ~25 px з
 * дверима 12 px — нижчими за голову з тулубом.
 */
function storeyOf(style: BuildingStyle): number {
  switch (style) {
    case 'coop': return 32;
    case 'kiosk': return 34;
    case 'shed': return 36;
    case 'barn': return 42;
    default: return 46;
  }
}

/** Висота стіни фасаду для сліду глибиною `h` клітинок. */
function wallOf(style: BuildingStyle, h: number): number {
  return Math.max(storeyOf(style), Math.round(h * TILE * (1 - STYLES[style].roofFrac)));
}

/** Двері — на зріст людини. */
const DOOR_H = 25;

// ------------------------------------------------------------
// Дах.
// ------------------------------------------------------------
/**
 * Де полотно спрайта стоїть у світі (px) — візерунок даху рахується від
 * світу, а не від краю спрайта, тож у частин однієї будівлі смуги соломи й
 * ряди черепиці продовжуються через стик, а не зсуваються.
 */
interface WorldAt { x: number; y: number }

/** Стале зерно від кольору даху: у частин однієї будівлі воно однакове. */
function colorSeed(color: string): number {
  let h = 7;
  for (let i = 0; i < color.length; i += 1) h = (h * 31 + color.charCodeAt(i)) >>> 0;
  return h;
}

function roof(g: Ctx, W: number, top: number, bottom: number, rule: StyleRule, color: string, season: Season, seed: number, flush: Flush = null, at: WorldAt = { x: 0, y: 0 }, flushRows: { from: number; until: number } = { from: -Infinity, until: Infinity }): void {
  const H = bottom - top;
  const cs = colorSeed(color);
  if (rule.roof === 'none') return;
  if (rule.roof === 'flat') {
    rect(g, 1, top, W - 2, H, color);
    rect(g, 1, top, W - 2, 2, shade(color, 0.25));
    rect(g, 1, bottom - 2, W - 2, 2, shade(color, -0.3));
    if (season === 'winter') rect(g, 2, top, W - 4, 2, '#ffffff');
    return;
  }
  const inset = rule.roof === 'thatch' ? 10 : 8;
  // Бік, яким дах прилягає до іншого крила тієї ж хати, — без скосу:
  // скати сходяться, і двох окремих дахів не видно.
  // Стик з іншою частиною — лише в тих рядках, де та частина справді
  // поруч; вище чи нижче — звичайний край даху.
  const fl = (r: number): Flush => (top + r >= flushRows.from && top + r < flushRows.until ? flush : null);
  const kl = (k: number, r = 0) => (fl(r) === 'left' ? 0 : k);
  const kr = (k: number, r = 0) => (fl(r) === 'right' ? 0 : k);
  const m6 = (v: number, n: number) => ((v % n) + n) % n;
  for (let r = 0; r < H; r += 1) {
    const k = Math.round((1 - r / H) * inset);
    const ry = at.y + top + r;
    const band = Math.floor(ry / 4);
    let c = color;
    if (rule.roof === 'thatch') {
      c = m6(ry, 3) === 0 ? shade(color, -0.12) : color;
    } else if (m6(ry, 4) === 3) c = shade(color, -0.28);
    else if (m6(ry, 4) === 0) c = shade(color, 0.14);
    const x0 = kl(k, r);
    const x1 = W - kr(k, r);
    rect(g, x0, top + r, x1 - x0, 1, c);
    // Шви черепиці / стебла соломи — за світовими координатами.
    if (rule.roof === 'tile' && m6(ry, 4) !== 3) {
      const off = m6(band, 2) === 0 ? 0 : 3;
      for (let x = x0; x < x1; x += 1) if (m6(at.x + x - off, 6) === 0) px(g, x, top + r, shade(color, -0.2));
    }
    if (rule.roof === 'metal' && m6(ry, 4) !== 3) {
      for (let x = x0; x < x1; x += 1) if (m6(at.x + x - 2, 5) === 0) px(g, x, top + r, shade(color, -0.12));
    }
    if (rule.roof === 'thatch') {
      for (let x = x0; x < x1; x += 1) if (cellHash(at.x + x, ry, cs) % 5 === 0) px(g, x, top + r, shade(color, 0.18));
    }
    // Темні краї даху.
    if (fl(r) !== 'left') px(g, k, top + r, shade(color, -0.35));
    if (fl(r) !== 'right') px(g, W - k - 1, top + r, shade(color, -0.35));
  }
  // Латки: стріху перекривали частинами, стара солома темніша й сіріша.
  if (rule.roof === 'thatch') {
    for (let n = 0; n < Math.floor((W * H) / 900); n += 1) {
      const hh = cellHash(n, seed, 21);
      const ry = 3 + (hh % Math.max(1, H - 9));
      const pw = 10 + ((hh >>> 6) % 14);
      const k = Math.round((1 - ry / H) * inset);
      const x0 = kl(k) + 2 + ((hh >>> 10) % Math.max(1, W - kl(k) - kr(k) - pw - 4));
      rect(g, x0, top + ry, pw, 3 + ((hh >>> 16) % 3), mix(color, '#8a7a5a', 0.3));
      rect(g, x0, top + ry, pw, 1, mix(color, '#8a7a5a', 0.45));
    }
  }
  // Гребінь.
  rect(g, kl(inset), top, W - kl(inset) - kr(inset), 2, shade(color, rule.roof === 'thatch' ? -0.2 : 0.3));
  // Звис: темна смуга знизу.
  rect(g, 0, bottom - 2, W, 2, shade(color, -0.42));
  if (rule.roof === 'thatch' && season !== 'winter') {
    // Солом'яна стріха звисає нерівною бахромою.
    for (let x = 1; x < W - 1; x += 1) {
      const len = cellHash(at.x + x, cs, 5) % 3;
      if (len) rect(g, x, bottom, 1, len, shade(color, x % 2 ? -0.18 : -0.05));
    }
  }
  if (season === 'winter') {
    // Сніг: шапка до половини даху з рваним краєм і бурульки.
    const snowH = Math.round(H * 0.55);
    for (let r = 0; r < snowH; r += 1) {
      const k = Math.round((1 - r / H) * inset);
      rect(g, kl(k), top + r, W - kl(k) - kr(k), 1, r > snowH - 3 ? '#dfe9f6' : '#ffffff');
    }
    for (let x = inset; x < W - inset; x += 1) {
      const drip = cellHash(x, seed) % 4;
      if (drip > 1) rect(g, x, top + snowH, 1, drip - 1, '#dfe9f6');
    }
    for (let x = 3; x < W - 3; x += 5 + (cellHash(x, seed, 2) % 4)) rect(g, x, bottom, 1, 2 + (cellHash(x, seed) % 3), '#cfe6f5');
  }
}

// ------------------------------------------------------------
// Стіна.
// ------------------------------------------------------------
function wall(g: Ctx, W: number, top: number, bottom: number, rule: StyleRule, color: string, seed: number, flush: Flush = null): void {
  const H = bottom - top;
  rect(g, 3, top, W - 6, H, color);
  if (rule.material === 'brick') {
    for (let r = 0; r < H; r += 3) {
      rect(g, 3, top + r + 2, W - 6, 1, shade(color, -0.2));
      const off = (r / 3) % 2 === 0 ? 0 : 3;
      for (let x = 3 + off; x < W - 3; x += 6) px(g, x, top + r, shade(color, -0.18));
      for (let x = 4; x < W - 3; x += 1) if (cellHash(x, r, seed) % 9 === 0) px(g, x, top + r + 1, shade(color, 0.1));
    }
  } else if (rule.material === 'wood') {
    for (let r = 0; r < H; r += 4) {
      rect(g, 3, top + r + 3, W - 6, 1, shade(color, -0.3));
      rect(g, 3, top + r, W - 6, 1, shade(color, 0.12));
    }
  } else if (rule.material === 'panel') {
    for (let x = 3; x < W - 3; x += 16) rect(g, x, top, 1, H, shade(color, -0.1));
    for (let r = 0; r < H; r += 12) rect(g, 3, top + r, W - 6, 1, shade(color, -0.1));
  } else if (rule.material === 'stone') {
    for (let r = 0; r < H; r += 5) {
      rect(g, 3, top + r + 4, W - 6, 1, shade(color, -0.12));
      const off = (r / 5) % 2 === 0 ? 0 : 5;
      for (let x = 3 + off; x < W - 3; x += 10) rect(g, x, top + r, 1, 4, shade(color, -0.1));
    }
  } else if (rule.material === 'glass') {
    for (let x = 3; x < W - 3; x += 1) {
      const t = (x / W + 0.2) % 1;
      rect(g, x, top, 1, H, mix(color, '#bfe0f2', t * 0.5));
    }
  } else {
    // Штукатурка: легкі плями й «цоколь» знизу.
    for (let k = 0; k < (W * H) / 40; k += 1) {
      const hh = cellHash(k, seed, 7);
      px(g, 3 + (hh % (W - 6)), top + ((hh >> 8) % H), shade(color, -0.06));
    }
  }
  // Освітлення: лівий край світліший, правий у тіні.
  // На стику з іншою частиною тієї ж будівлі краю немає — стіна йде далі.
  if (flush !== 'left') rect(g, 3, top, 2, H, shade(color, 0.12));
  else rect(g, 0, top, 3, H, color);
  if (flush !== 'right') rect(g, W - 6, top, 3, H, shade(color, -0.2));
  else rect(g, W - 3, top, 3, H, color);
  // Цоколь.
  const x0 = flush === 'left' ? 0 : 3;
  const x1 = flush === 'right' ? W : W - 3;
  rect(g, x0, bottom - 3, x1 - x0, 3, shade(color, -0.32));
  rect(g, x0, bottom - 3, x1 - x0, 1, shade(color, -0.2));
}

// ------------------------------------------------------------
// Вікна й двері.
// ------------------------------------------------------------
const CURTAINS = ['#e98fb0', '#f6d55c', '#8fd0a0', '#b9a7f2', '#f4f4f7', '#f39c6b'];

function windowAt(g: Ctx, x: number, y: number, w: number, h: number, frame: string, seed: number, shutters: boolean, out: Rect[]): void {
  rect(g, x - 1, y - 1, w + 2, h + 2, frame);
  rect(g, x, y, w, h, '#9fd0ec');
  rect(g, x, y, w, Math.ceil(h / 2), '#bfe3f5');
  // Відблиск по діагоналі.
  for (let k = 0; k < Math.min(w, h) - 1; k += 1) px(g, x + 1 + k, y + h - 2 - k, k < 2 ? '#ffffff' : '#d9f0fb');
  // Хрестовина.
  if (w >= 6) rect(g, x + Math.floor(w / 2), y, 1, h, frame);
  if (h >= 7) rect(g, x, y + Math.floor(h / 2), w, 1, frame);
  // Фіранки.
  const c = CURTAINS[seed % CURTAINS.length]!;
  rect(g, x, y, 2, h, c);
  rect(g, x + w - 2, y, 2, h, c);
  rect(g, x, y, w, 1, shade(c, -0.15));
  // Підвіконня.
  rect(g, x - 2, y + h + 1, w + 4, 1, shade(frame, -0.25));
  if (shutters) {
    rect(g, x - 4, y - 1, 3, h + 2, frame);
    rect(g, x + w + 1, y - 1, 3, h + 2, frame);
    px(g, x - 3, y + 2, shade(frame, 0.3));
    px(g, x + w + 2, y + 2, shade(frame, 0.3));
  }
  out.push({ x, y, w, h });
}

function flowerBox(g: Ctx, x: number, y: number, w: number, season: Season): void {
  rect(g, x - 1, y, w + 2, 3, '#8a5a34');
  if (season === 'winter') { rect(g, x - 1, y - 1, w + 2, 1, '#ffffff'); return; }
  for (let k = 0; k < w; k += 2) px(g, x + k, y - 1, ['#ff7aa8', '#f6d55c', '#e8576c'][k % 3]!);
  rect(g, x, y - 2, w, 1, '#4f9a3e');
}

/** Наличник над вікном хати: різьблена дошка з «дашком», фарбована як віконниці. */
function lintel(g: Ctx, x: number, y: number, w: number, color: string): void {
  rect(g, x - 4, y - 4, w + 8, 2, color);
  rect(g, x - 2, y - 5, w + 4, 1, color);
  rect(g, x + Math.floor(w / 2) - 1, y - 7, 2, 2, color);
  rect(g, x - 4, y - 4, w + 8, 1, shade(color, 0.3));
  for (let k = x - 3; k < x + w + 4; k += 3) px(g, k, y - 2, shade(color, -0.2));
}

/** Розпис під стріхою: тонка смуга ромбиків, червоне з чорним. */
function ornament(g: Ctx, W: number, y: number): void {
  for (let x = 6; x < W - 6; x += 6) {
    px(g, x, y, '#b8323a'); px(g, x - 1, y + 1, '#b8323a'); px(g, x + 1, y + 1, '#b8323a'); px(g, x, y + 2, '#b8323a');
    px(g, x, y + 1, '#2b2b33');
    px(g, x + 3, y + 1, '#3f6fb0');
  }
}

/**
 * Мальви під стіною — ознака сільської хати. Стебла між вікнами й не біля
 * дверей; восени квітів менше, узимку їх немає.
 */
function mallows(g: Ctx, W: number, Ht: number, avoid: { x0: number; x1: number }[], season: Season, seed: number): void {
  if (season === 'winter') return;
  const tones = ['#e8577c', '#f29ab6', '#fbf2f5', '#b8323a'];
  for (let x = 7; x < W - 8; x += 7 + (cellHash(x, seed, 9) % 5)) {
    if (avoid.some((a) => x > a.x0 - 3 && x < a.x1 + 3)) continue;
    if (cellHash(x, seed, 3) % 3 === 0) continue;
    const h = 16 + (cellHash(x, seed, 4) % 8);
    const base = Ht - 3;
    rect(g, x, base - h, 1, h, '#4f8a3a');
    for (let k = 4; k < h; k += 4) { px(g, x - 1, base - k, '#5fa04a'); px(g, x + 1, base - k - 2, '#5fa04a'); }
    const blooms = season === 'autumn' ? 1 : 3;
    for (let k = 0; k < blooms; k += 1) {
      const c = tones[(cellHash(x, k, seed) % tones.length)]!;
      const fy = base - h + 2 + k * 5;
      rect(g, x - 1, fy, 3, 3, c);
      px(g, x, fy + 1, '#f6d55c');
    }
  }
}

function door(g: Ctx, x: number, bottom: number, w: number, h: number, kind: 'wood' | 'glass' | 'double'): void {
  const y = bottom - h;
  rect(g, x - 2, y - 2, w + 4, h + 2, '#5a3a24');
  if (kind === 'glass' || kind === 'double') {
    rect(g, x, y, w, h, '#7fb8d8');
    rect(g, x, y, w, 2, '#bfe3f5');
    rect(g, x + Math.floor(w / 2), y, 1, h, '#3a2f28');
    px(g, x + 2, y + 4, '#ffffff');
  } else {
    rect(g, x, y, w, h, '#8a5a34');
    rect(g, x, y, w, 1, '#a8784a');
    rect(g, x + 1, y + 2, w - 2, Math.floor(h / 2) - 2, '#7a4a2a');
    rect(g, x + 1, y + Math.floor(h / 2) + 1, w - 2, Math.floor(h / 2) - 3, '#7a4a2a');
    px(g, x + w - 2, y + Math.floor(h / 2) + 1, '#f6c14e');
  }
  // Ґанок.
  rect(g, x - 3, bottom, w + 6, 2, '#b8b0a2');
  rect(g, x - 3, bottom, w + 6, 1, '#d8d0c2');
}

function awning(g: Ctx, x0: number, x1: number, y: number, color: string, season: Season): void {
  const W = x1 - x0;
  for (let k = 0; k < W; k += 1) {
    const stripe = Math.floor(k / 4) % 2 === 0 ? color : '#f8f4ec';
    rect(g, x0 + k, y, 1, 6, stripe);
    // Хвилястий край.
    const scallop = (k % 4 === 1 || k % 4 === 2) ? 2 : 1;
    rect(g, x0 + k, y + 6, 1, scallop, stripe);
  }
  rect(g, x0, y, W, 1, shade(color, -0.3));
  rect(g, x0, y + 8, W, 1, 'rgba(0,0,0,0.18)');
  if (season === 'winter') rect(g, x0, y - 1, W, 2, '#ffffff');
}

function signBoard(g: Ctx, cx: number, y: number, icon: Building['sign']): void {
  if (!icon) return;
  const [iw, ih] = bitmapSize(icon);
  const w = iw + 6;
  const h = ih + 4;
  const x = Math.round(cx - w / 2);
  rect(g, x, y, w, h, '#5a3a24');
  rect(g, x + 1, y + 1, w - 2, h - 2, '#f4e2bc');
  rect(g, x + 1, y + 1, w - 2, 1, '#fff4dc');
  drawBitmap(g, icon, x + 3, y + 2);
}

// ------------------------------------------------------------
// Особливе для окремих будівель.
// ------------------------------------------------------------
function dome(g: Ctx, cx: number, base: number, r: number, gold: boolean): void {
  const c = gold ? '#e8b83a' : '#3f8a6a';
  rect(g, cx - 1, base - r * 2 - 9, 2, 7, '#e8b83a');
  rect(g, cx - 3, base - r * 2 - 7, 6, 1, '#e8b83a');
  disc(g, cx, base - r, r, c);
  disc(g, cx - Math.round(r / 3), base - r - Math.round(r / 3), Math.max(1, Math.round(r / 3)), shade(c, 0.35));
  rect(g, cx - r + 1, base - 2, r * 2 - 1, 3, shade(c, -0.25));
  rect(g, cx - r + 2, base, r * 2 - 3, 6, '#f8f6f0');
  rect(g, cx - 1, base + 1, 2, 4, '#7fb8d8');
}

function clockFace(g: Ctx, cx: number, cy: number, r: number): void {
  disc(g, cx, cy, r + 1, '#3a2f28');
  disc(g, cx, cy, r, '#f8f4ec');
  rect(g, cx, cy - r + 1, 1, r - 1, '#3a2f28');
  rect(g, cx, cy, r - 1, 1, '#3a2f28');
}

function flag(g: Ctx, x: number, y: number): void {
  rect(g, x, y, 1, 16, '#8a8a94');
  rect(g, x + 1, y, 8, 3, '#3f7fd8');
  rect(g, x + 1, y + 3, 8, 3, '#f6d24a');
}

function columns(g: Ctx, x0: number, x1: number, top: number, bottom: number): void {
  for (let x = x0; x <= x1; x += 8) {
    rect(g, x, top, 4, bottom - top, '#f8f4ec');
    rect(g, x + 3, top, 1, bottom - top, '#d8d0c2');
    rect(g, x - 1, top, 6, 2, '#e8e0d0');
    rect(g, x - 1, bottom - 2, 6, 2, '#e8e0d0');
  }
}

// ------------------------------------------------------------
// Збірка.
// ------------------------------------------------------------
const cache = new Map<string, BuildingSprite>();

export function buildingSprite(b: Building, season: Season): BuildingSprite {
  const n = b.notch;
  const key = `${b.id}|${b.style}|${b.x},${b.y},${b.w},${b.h}|${season}|${b.wall ?? ''}|${b.roof ?? ''}|${b.door === false ? 'nodoor' : ''}|${n ? `${n.side}${n.w}x${n.h}` : ''}|${b.sideDoor ? 'side' : ''}|${b.join ?? ''}${b.joinTo ? `@${b.joinTo.x},${b.joinTo.y},${b.joinTo.w},${b.joinTo.h}` : ''}|${b.chimney === false ? 'nochim' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const sprite = n ? ellSprite(b, season) : partSprite(b, season, joinOpts(b));
  disciplinePalette(sprite.img);
  cache.set(key, sprite);
  return sprite;
}

/**
 * Частина споруди з двох будівель (`join`, крила хати різної глибини):
 *   • гребінь спільний — дах нижчої (меншої вглиб) частини тягнеться до
 *     гребеня сусідньої, тож дах читається одним;
 *   • дах без краю лише в рядках, де поруч справді дах сусіда; нижче —
 *     звичайний край (там кут крила, що виступає);
 *   • стіна без краю, лише якщо фасади на одній лінії.
 */
function joinOpts(b: Building): PartOpts {
  const opts: PartOpts = { flush: b.join ?? null, chimney: b.chimney !== false };
  const n = b.joinTo;
  if (!b.join || !n) return opts;
  const rule = STYLES[b.style];
  const extra = Math.max(0, b.y - n.y) * TILE;
  const wallPx = wallOf(b.style, b.h);
  const Ht = rule.rise + Math.round(b.h * TILE * rule.roofFrac) + extra + wallPx;
  const top = (b.y + b.h) * TILE - Ht;
  // Звис сусіда — у світі; рядки даху вище за нього прилягають до сусіда.
  const nEave = (n.y + n.h) * TILE - wallOf(b.style, n.h);
  return { ...opts, extraRoof: extra, flushRows: { from: -Infinity, until: nEave - top }, wallFlush: n.y + n.h === b.y + b.h ? b.join : null };
}

/**
 * Г-подібна споруда — одна будівля з двох крил. Обидва крила мають
 * однакову висоту стіни, тож фасад і звис даху — одна лінія; дах нижчого
 * крила прилягає до вищого без скосу; димар один, двері одні.
 */
function ellSprite(b: Building, season: Season): BuildingSprite {
  const rule = STYLES[b.style];
  const [tall, low] = buildingParts(b) as [Rect, Rect];
  const wallPx = wallOf(b.style, low.h);
  const side = b.notch!.side;
  const hasDoor = (r: Rect) => b.door !== false && b.doorX >= r.x && b.doorX < r.x + r.w;
  const rightEdge = (r: Rect) => !!b.sideDoor && r.x + r.w === b.x + b.w;
  // Стик: у високого крила — з боку низького, у низького — з боку високого.
  // Стіни на одній лінії фасаду, тож шва на них немає зовсім; дах високого
  // крила без краю лише там, де поруч дах низького.
  const toLow: Flush = side === 'right' ? 'right' : 'left';
  const toTall: Flush = side === 'right' ? 'left' : 'right';
  const lowTop = (tall.h - low.h) * TILE * rule.roofFrac;
  const A = partSprite({ ...b, ...tall, notch: undefined, door: hasDoor(tall), sideDoor: rightEdge(tall) }, season, { wallPx, flush: toLow, flushRows: { from: Math.round(lowTop) + rule.rise, until: Infinity }, wallFlush: toLow, chimney: true });
  const B = partSprite({ ...b, ...low, notch: undefined, door: hasDoor(low), sideDoor: rightEdge(low) }, season, { wallPx, flush: toTall, wallFlush: toTall, chimney: false });
  const W = b.w * TILE + 6;
  // Обидва крила стоять на одній лінії фасаду: низи спрайтів збігаються.
  const Ht = A.img.height;
  const img = canvas(W, Ht);
  const g = ctx2d(img);
  const ax = (tall.x - b.x) * TILE;
  const bx = (low.x - b.x) * TILE;
  const by = Ht - B.img.height;
  g.drawImage(A.img, ax, 0);
  g.drawImage(B.img, bx, by);
  const windows = [...A.windows.map((w) => ({ ...w, x: w.x + ax })), ...B.windows.map((w) => ({ ...w, x: w.x + bx, y: w.y + by }))];
  return { img, ox: -3, oy: -(Ht - b.h * TILE), windows, smoke: A.smoke ? { x: A.smoke.x + ax, y: A.smoke.y } : null };
}

interface PartOpts {
  /** Висота стіни фасаду (px) — спільна для крил Г-подібної хати. */
  wallPx?: number;
  /** Бік стику для даху. */
  flush?: Flush;
  /** Рядки спрайта, у яких дах справді прилягає до сусідньої частини. */
  flushRows?: { from: number; until: number };
  /** Бік стику для стіни — лише коли фасади на одній лінії. */
  wallFlush?: Flush;
  /** На скільки px дах тягнеться вглиб понад слід (спільний гребінь). */
  extraRoof?: number;
  chimney?: boolean;
}

function partSprite(b: Building, season: Season, opts: PartOpts): BuildingSprite {
  const rule = STYLES[b.style];
  const seed = cellHash(b.x, b.y, b.w * 31 + b.h);
  const W = b.w * TILE + 6;
  // Дах — як і раніше, частка глибини сліду; стіна — щонайменше поверх.
  // Зайва висота росте вгору: низ спрайта завжди на нижньому краї сліду.
  const roofBottom = rule.rise + Math.round(b.h * TILE * rule.roofFrac) + (opts.extraRoof ?? 0);
  const wallPx = opts.wallPx ?? wallOf(b.style, b.h);
  const Ht = roofBottom + wallPx;
  const img = canvas(W, Ht);
  const g = ctx2d(img);
  const wallColor = b.wall ?? rule.wall;
  const roofColor = b.roof ?? rule.roofColor;
  const windows: Rect[] = [];
  const doorCx = (b.doorX - b.x) * TILE + 8 + 3;

  wall(g, W, roofBottom - 2, Ht, rule, wallColor, seed, opts.wallFlush ?? null);

  // Вікна рядами по фасаду, оминаючи двері.
  const wallTop = roofBottom + 3;
  const wallH = Ht - wallTop - 3;
  const doorKind = rule.window === 'shop' || rule.material === 'glass' ? 'glass' : rule.material === 'stone' ? 'double' : 'wood';
  const dw = b.style === 'barn' ? 18 : doorKind === 'wood' ? 12 : 16;
  const dh = Math.min(DOOR_H, wallH - 4);
  const doorHalf = dw / 2 + 3;
  const cottage = b.style === 'cottage';
  // На стику з іншою частиною стіни смуги (тінь під звисом, цоколь,
  // призьба) доходять до краю полотна, щоб не лишалося щілини.
  const sx0 = opts.wallFlush === 'left' ? 0 : 3;
  const sx1 = opts.wallFlush === 'right' ? W : W - 3;
  const place = (ww: number, wh: number, gap: number, rows: number, shutters: boolean, box: boolean) => {
    const rowH = Math.floor(wallH / rows);
    for (let r = 0; r < rows; r += 1) {
      const y = wallTop + r * rowH + Math.max(2, Math.floor((rowH - wh) / 2) - (r === rows - 1 ? 2 : 0));
      for (let x = 8; x + ww <= W - 8; x += ww + gap) {
        if (r === rows - 1 && x + ww > doorCx - doorHalf - 2 && x < doorCx + doorHalf + 2) continue;
        windowAt(g, x, y, ww, wh, rule.frame, seed + x * 7 + r, shutters, windows);
        if (cottage) lintel(g, x, y, ww, rule.frame);
        if (box && season !== 'winter') flowerBox(g, x, y + wh + 2, ww, season);
      }
    }
  };
  switch (rule.window) {
    case 'small':
      // Господарські будівлі — одне маленьке віконце, без квітів.
      if (b.style === 'barn' || b.style === 'coop' || b.style === 'shed') windowAt(g, 7, wallTop + 4, 8, 7, rule.frame, seed, false, windows);
      // Хата — вікна парами, по кімнатах, а не суцільним рядом.
      else place(10, 12, cottage ? 18 : 12, 1, cottage, cottage || b.style === 'house');
      break;
    case 'tall': place(8, 14, 8, Math.max(1, Math.floor(wallH / 22)), false, false); break;
    case 'grid': place(7, 9, 7, Math.max(2, Math.floor(wallH / 15)), false, false); break;
    case 'arch': place(8, 14, 9, Math.max(1, Math.floor(wallH / 24)), false, false); break;
    case 'curtain': {
      for (let x = 6; x < W - 8; x += 9) for (let y = wallTop; y < Ht - 18; y += 10) {
        rect(g, x, y, 7, 8, '#a9cfe6');
        rect(g, x, y, 7, 2, '#d9f0fb');
        windows.push({ x, y, w: 7, h: 8 });
      }
      break;
    }
    case 'shop': {
      // Вітрини по боках дверей.
      const wy = Ht - 24;
      if (doorCx - doorHalf - 6 > 8) windowAt(g, 7, wy, doorCx - doorHalf - 12, 15, rule.frame, seed, false, windows);
      if (W - 7 - (doorCx + doorHalf + 6) > 6) windowAt(g, doorCx + doorHalf + 5, wy, W - 12 - (doorCx + doorHalf + 5), 15, rule.frame, seed + 3, false, windows);
      break;
    }
  }

  // Хата: призьба — низький глиняний виступ уздовж стіни, підведений синім.
  if (cottage) {
    rect(g, sx0, Ht - 6, sx1 - sx0, 6, '#6f86ad');
    rect(g, sx0, Ht - 6, sx1 - sx0, 1, '#9fb3d3');
    rect(g, sx0, Ht - 1, sx1 - sx0, 1, '#4f6488');
    ornament(g, W, roofBottom + 3);
    const avoid = windows.map((w) => ({ x0: w.x - 4, x1: w.x + w.w + 4 }));
    if (b.door !== false) avoid.push({ x0: doorCx - dw / 2 - 3, x1: doorCx + dw / 2 + 3 });
    if (b.sideDoor) avoid.push({ x0: W - 16, x1: W });
    mallows(g, W, Ht, avoid, season, seed);
  }

  // Двері. Хлів — широкі дощані ворота; глуха частина хати — без дверей.
  if (b.door !== false) {
    door(g, doorCx - dw / 2, Ht - 2, dw, dh, b.style === 'barn' ? 'wood' : doorKind);
    if (b.style === 'barn') rect(g, doorCx - 1, Ht - dh - 2, 1, dh, '#5a3a24');
  }

  // Вхід збоку: у ракурсі «три чверті» бічна стіна не видна, тож двері —
  // вузькі, на самому краю, з козирком і приступком праворуч.
  if (b.sideDoor) {
    const sh = Math.min(DOOR_H, wallH - 4);
    rect(g, W - 9, Ht - sh - 3, 6, sh + 1, '#5a3a24');
    rect(g, W - 8, Ht - sh - 2, 4, sh - 1, '#8a5a34');
    rect(g, W - 8, Ht - sh - 2, 4, 1, '#a8784a');
    px(g, W - 7, Ht - Math.round(sh / 2) - 2, '#f6c14e');
    // Ґанок: козирок на стовпчику над дверима.
    rect(g, W - 13, Ht - sh - 7, 13, 3, shade(roofColor, -0.25));
    rect(g, W - 13, Ht - sh - 7, 13, 1, shade(roofColor, 0.15));
    rect(g, W - 2, Ht - sh - 4, 1, sh + 2, '#6e4a2a');
  }

  // Дах і все, що над ним.
  roof(g, W, rule.rise, roofBottom, rule, roofColor, season, seed, opts.flush ?? null, { x: b.x * TILE - 3, y: (b.y + b.h) * TILE - Ht }, opts.flushRows);
  // Тінь від даху на стіну.
  rect(g, sx0, roofBottom, sx1 - sx0, 2, 'rgba(30,20,30,0.28)');

  let smoke: BuildingSprite['smoke'] = null;
  if (rule.chimney && opts.chimney !== false) {
    const cx = W - 16;
    const top = rule.rise + 2;
    rect(g, cx, top - 8, 6, 12, '#9a5a44');
    rect(g, cx - 1, top - 9, 8, 2, '#7a4a3a');
    for (let r = 0; r < 10; r += 3) rect(g, cx, top - 6 + r, 6, 1, '#7a4a3a');
    if (season === 'winter') rect(g, cx - 1, top - 10, 8, 2, '#ffffff');
    smoke = { x: cx + 3, y: top - 10 };
  }
  if (rule.awning) awning(g, 4, W - 4, roofBottom + 1, b.style === 'cafe' ? '#2f8a5a' : b.style === 'kiosk' ? '#3a6fd8' : '#d9534f', season);
  if (b.sign) signBoard(g, doorCx, rule.awning ? roofBottom - 10 : roofBottom + 2, b.sign);

  if (b.style === 'school' || b.style === 'uni' || b.style === 'lyceum') flag(g, W - 12, Math.max(0, rule.rise - 14));
  if (b.style === 'school') clockFace(g, doorCx, roofBottom - 7, 4);
  if (b.style === 'uni' || b.style === 'station') {
    // Портик: колони й трикутний фронтон.
    const px0 = doorCx - 18;
    const px1 = doorCx + 14;
    columns(g, px0, px1, roofBottom + 2, Ht - 3);
    for (let r = 0; r < 10; r += 1) rect(g, px0 - 4 + r * 2, roofBottom - 8 + r, px1 - px0 + 12 - r * 4, 1, r === 0 ? '#d8d0c2' : '#f4ecdc');
    if (b.style === 'station') clockFace(g, doorCx, roofBottom - 3, 4);
  }
  if (b.style === 'sadok') {
    // Намальоване сонечко й веселкова смуга під дахом.
    disc(g, 12, roofBottom + 9, 4, '#f6c14e');
    for (const [dx, dy] of [[-6, 0], [6, 0], [0, -6], [0, 6], [-4, -4], [4, 4], [4, -4], [-4, 4]] as const) px(g, 12 + dx, roofBottom + 9 + dy, '#f6c14e');
    ['#e8576c', '#f6c14e', '#7ed957', '#5aa7e0'].forEach((c, k) => rect(g, 3, roofBottom + k, W - 6, 1, c));
  }
  if (b.style === 'lavra' || b.style === 'church') {
    const base = rule.rise + 6;
    dome(g, Math.round(W / 2), base, 9, true);
    if (W > 60) { dome(g, 18, base + 6, 5, b.style === 'lavra'); dome(g, W - 18, base + 6, 5, b.style === 'lavra'); }
  }
  if (b.style === 'ratusha') {
    // Вежа з годинником над серединою.
    const cx = Math.round(W / 2);
    rect(g, cx - 9, 6, 18, rule.rise + 4, '#e8d8b8');
    rect(g, cx + 5, 6, 4, rule.rise + 4, '#cfbf9f');
    for (let r = 10; r < rule.rise; r += 6) rect(g, cx - 9, r, 18, 1, '#cfbf9f');
    clockFace(g, cx, 16, 5);
    for (let r = 0; r < 7; r += 1) rect(g, cx - 9 + r, r, 18 - r * 2, 1, '#4a8f7a');
    rect(g, cx - 1, -0, 2, 2, '#e8b83a');
    rect(g, cx - 4, rule.rise - 6, 3, 6, '#7fb8d8');
    rect(g, cx + 1, rule.rise - 6, 3, 6, '#7fb8d8');
  }
  if (b.style === 'block') {
    // Балкони з білизною.
    for (let r = wallTop + 10; r < Ht - 16; r += 13) {
      for (let x = 10; x < W - 14; x += 24) {
        rect(g, x, r, 14, 4, shade(wallColor, -0.15));
        rect(g, x, r, 14, 1, '#f4f4f7');
        if (cellHash(x, r, seed) % 3 === 0) { px(g, x + 3, r - 2, '#e98fb0'); px(g, x + 6, r - 2, '#5aa7e0'); }
      }
    }
  }
  if (b.style === 'busStation') {
    const [iw] = bitmapSize('bus');
    rect(g, 5, rule.rise + 1, iw + 4, 10, '#f4f4f7');
    drawBitmap(g, 'bus', 7, rule.rise + 3);
  }

  return { img, ox: -3, oy: -(Ht - b.h * TILE), windows, smoke };
}

/** Тінь будинку на землі: зсунута вправо-вниз, як від сонця зліва вгорі. */
export function drawBuildingShadow(g: Ctx, b: Building): void {
  if (b.notch) {
    for (const r of buildingParts(b)) drawBuildingShadow(g, { ...b, ...r, notch: undefined });
    return;
  }
  const x = b.x * TILE;
  const y = b.y * TILE;
  g.fillStyle = 'rgba(28,20,40,0.22)';
  g.beginPath();
  g.moveTo(x + b.w * TILE, y + 6);
  g.lineTo(x + b.w * TILE + 8, y + 14);
  g.lineTo(x + b.w * TILE + 8, y + b.h * TILE + 5);
  g.lineTo(x + 6, y + b.h * TILE + 5);
  g.lineTo(x, y + b.h * TILE);
  g.closePath();
  g.fill();
  ellipse(g, x + 2, y + b.h * TILE, 2, 1, 'rgba(28,20,40,0.12)');
}
