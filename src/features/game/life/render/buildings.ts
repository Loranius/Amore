// ============================================================
// Будинки «Дєвочка в городі» (ADR-0239) у ракурсі «три чверті»: дах, що
// звужується догори рядами черепиці, фасад із фактурою, вікна з
// рамами й фіранками, двері з ґанком, вивіска з піктограмою.
// Узимку на дахах сніг і бурульки; вночі вікна світяться (`windows`).
// ============================================================
import type { Season } from '../sim/calendar';
import { TILE, type Building, type BuildingStyle, type Rect } from '../world/types';
import { bitmapSize, drawBitmap } from './icons';
import { canvas, cellHash, ctx2d, disc, ellipse, mix, px, rect, shade, type Ctx } from './pixel';

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

// ------------------------------------------------------------
// Дах.
// ------------------------------------------------------------
function roof(g: Ctx, W: number, top: number, bottom: number, rule: StyleRule, color: string, season: Season, seed: number): void {
  const H = bottom - top;
  if (rule.roof === 'none') return;
  if (rule.roof === 'flat') {
    rect(g, 1, top, W - 2, H, color);
    rect(g, 1, top, W - 2, 2, shade(color, 0.25));
    rect(g, 1, bottom - 2, W - 2, 2, shade(color, -0.3));
    if (season === 'winter') rect(g, 2, top, W - 4, 2, '#ffffff');
    return;
  }
  const inset = rule.roof === 'thatch' ? 10 : 8;
  for (let r = 0; r < H; r += 1) {
    const k = Math.round((1 - r / H) * inset);
    const band = Math.floor(r / 4);
    let c = color;
    if (rule.roof === 'thatch') {
      c = r % 3 === 0 ? shade(color, -0.12) : color;
    } else if (r % 4 === 3) c = shade(color, -0.28);
    else if (r % 4 === 0) c = shade(color, 0.14);
    rect(g, k, top + r, W - 2 * k, 1, c);
    // Шви черепиці / стебла соломи.
    if (rule.roof === 'tile' && r % 4 !== 3) {
      const off = band % 2 === 0 ? 0 : 3;
      for (let x = k + off; x < W - k; x += 6) px(g, x, top + r, shade(color, -0.2));
    }
    if (rule.roof === 'metal' && r % 4 !== 3) {
      for (let x = k + 2; x < W - k; x += 5) px(g, x, top + r, shade(color, -0.12));
    }
    if (rule.roof === 'thatch') {
      for (let x = k; x < W - k; x += 1) if (cellHash(x, r, seed) % 5 === 0) px(g, x, top + r, shade(color, 0.18));
    }
    // Темні краї даху.
    px(g, k, top + r, shade(color, -0.35));
    px(g, W - k - 1, top + r, shade(color, -0.35));
  }
  // Гребінь.
  rect(g, inset, top, W - 2 * inset, 2, shade(color, rule.roof === 'thatch' ? -0.2 : 0.3));
  // Звис: темна смуга знизу.
  rect(g, 0, bottom - 2, W, 2, shade(color, -0.42));
  if (season === 'winter') {
    // Сніг: шапка до половини даху з рваним краєм і бурульки.
    const snowH = Math.round(H * 0.55);
    for (let r = 0; r < snowH; r += 1) {
      const k = Math.round((1 - r / H) * inset);
      rect(g, k, top + r, W - 2 * k, 1, r > snowH - 3 ? '#dfe9f6' : '#ffffff');
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
function wall(g: Ctx, W: number, top: number, bottom: number, rule: StyleRule, color: string, seed: number): void {
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
  rect(g, 3, top, 2, H, shade(color, 0.12));
  rect(g, W - 6, top, 3, H, shade(color, -0.2));
  // Цоколь.
  rect(g, 3, bottom - 3, W - 6, 3, shade(color, -0.32));
  rect(g, 3, bottom - 3, W - 6, 1, shade(color, -0.2));
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
  const key = `${b.id}|${b.style}|${b.x},${b.y},${b.w},${b.h}|${season}|${b.wall ?? ''}|${b.roof ?? ''}|${b.door === false ? 'nodoor' : ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rule = STYLES[b.style];
  const seed = cellHash(b.x, b.y, b.w * 31 + b.h);
  const W = b.w * TILE + 6;
  const Ht = b.h * TILE + rule.rise;
  const img = canvas(W, Ht);
  const g = ctx2d(img);
  const wallColor = b.wall ?? rule.wall;
  const roofColor = b.roof ?? rule.roofColor;
  const roofBottom = rule.rise + Math.round(b.h * TILE * rule.roofFrac);
  const windows: Rect[] = [];
  const doorCx = (b.doorX - b.x) * TILE + 8 + 3;

  wall(g, W, roofBottom - 2, Ht, rule, wallColor, seed);

  // Вікна рядами по фасаду, оминаючи двері.
  const wallTop = roofBottom + 3;
  const wallH = Ht - wallTop - 3;
  const doorHalf = rule.window === 'shop' ? 9 : 7;
  const place = (ww: number, wh: number, gap: number, rows: number, shutters: boolean, box: boolean) => {
    const rowH = Math.floor(wallH / rows);
    for (let r = 0; r < rows; r += 1) {
      const y = wallTop + r * rowH + Math.max(2, Math.floor((rowH - wh) / 2) - (r === rows - 1 ? 2 : 0));
      for (let x = 8; x + ww <= W - 8; x += ww + gap) {
        if (r === rows - 1 && x + ww > doorCx - doorHalf - 2 && x < doorCx + doorHalf + 2) continue;
        windowAt(g, x, y, ww, wh, rule.frame, seed + x * 7 + r, shutters, windows);
        if (box && season !== 'winter') flowerBox(g, x, y + wh + 2, ww, season);
      }
    }
  };
  switch (rule.window) {
    case 'small':
      // Господарські будівлі — одне маленьке віконце, без квітів.
      if (b.style === 'barn' || b.style === 'coop' || b.style === 'shed') windowAt(g, 6, wallTop + 3, 6, 5, rule.frame, seed, false, windows);
      else place(8, 8, 10, 1, b.style === 'cottage', b.style === 'cottage' || b.style === 'house');
      break;
    case 'tall': place(7, 11, 6, Math.max(1, Math.floor(wallH / 18)), false, false); break;
    case 'grid': place(6, 7, 6, Math.max(2, Math.floor(wallH / 13)), false, false); break;
    case 'arch': place(7, 12, 8, Math.max(1, Math.floor(wallH / 20)), false, false); break;
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
      const wy = Ht - 20;
      if (doorCx - doorHalf - 6 > 8) windowAt(g, 7, wy, doorCx - doorHalf - 12, 12, rule.frame, seed, false, windows);
      if (W - 7 - (doorCx + doorHalf + 6) > 6) windowAt(g, doorCx + doorHalf + 5, wy, W - 12 - (doorCx + doorHalf + 5), 12, rule.frame, seed + 3, false, windows);
      break;
    }
  }

  // Двері. Хлів — широкі дощані ворота; глуха частина хати — без дверей.
  if (b.door !== false) {
    const doorKind = rule.window === 'shop' || rule.material === 'glass' ? 'glass' : rule.material === 'stone' ? 'double' : 'wood';
    const dw = doorKind === 'double' || b.style === 'barn' ? 12 : 8;
    door(g, doorCx - dw / 2, Ht - 2, dw, rule.window === 'grid' ? 11 : 12, b.style === 'barn' ? 'wood' : doorKind);
    if (b.style === 'barn') rect(g, doorCx - 1, Ht - 13, 1, 11, '#5a3a24');
  }

  // Дах і все, що над ним.
  roof(g, W, rule.rise - (rule.roof === 'flat' ? 0 : 0), roofBottom, rule, roofColor, season, seed);
  // Тінь від даху на стіну.
  rect(g, 3, roofBottom, W - 6, 2, 'rgba(30,20,30,0.28)');

  let smoke: BuildingSprite['smoke'] = null;
  if (rule.chimney) {
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

  const sprite: BuildingSprite = { img, ox: -3, oy: -rule.rise, windows, smoke };
  cache.set(key, sprite);
  return sprite;
}

/** Тінь будинку на землі: зсунута вправо-вниз, як від сонця зліва вгорі. */
export function drawBuildingShadow(g: Ctx, b: Building): void {
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
