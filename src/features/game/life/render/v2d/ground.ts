// ============================================================
// 2D-стиль: земля (ADR-0239). Трава — м'якими плямами світла й тіні,
// стежки й бруківка — суцільними формами із заокругленими зовнішніми
// кутами, грядки — борозни, підлога — дошки, стіни — шпалери й камінь.
// Кешується на мапу × пору року × роздільність.
// ============================================================
import type { Season } from '../../sim/calendar';
import { TILE, type GameMap, type Ground } from '../../world/types';
import { PALETTES, type SeasonPalette } from '../palette';
import { box, circle, hash01, hires, line, oval, rr, shade, mix, type Ctx } from './kit';

const cache = new Map<string, HTMLCanvasElement>();

/** Які ґрунти зливаються в одну форму (кути між ними не заокруглюються). */
const GROUP: Partial<Record<Ground, string>> = { d: 'path', c: 'cobble', p: 'pave', v: 'bed', a: 'road', m: 'road', z: 'road', s: 'sand', b: 'sand', w: 'water' };

export function groundCanvas2d(map: GameMap, season: Season, res: number): HTMLCanvasElement {
  const key = `${map.id}|${season}|${res}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const P = PALETTES[map.interior ? 'summer' : season];
  const { c, g } = hires(map.w * TILE, map.h * TILE, res);
  if (map.interior) interior(g, map);
  else outdoor(g, map, P, season, res);
  cache.set(key, c);
  return c;
}

const at = (map: GameMap, i: number, j: number): Ground | undefined => map.ground[j]?.[i];

// ------------------------------------------------------------
// Надворі.
// ------------------------------------------------------------
function outdoor(g: Ctx, map: GameMap, P: SeasonPalette, season: Season, res: number): void {
  const W = map.w * TILE;
  const H = map.h * TILE;
  g.fillStyle = P.grass;
  g.fillRect(0, 0, W, H);
  // Великі м'які плями світла й тіні — трава живе, а не однотонна.
  for (let k = 0; k < (map.w * map.h) / 10; k += 1) {
    const x = hash01(k, 1, 91) * W;
    const y = hash01(k, 2, 91) * H;
    const r = 18 + hash01(k, 3, 91) * 46;
    const col = k % 3 === 0 ? P.grassDark : P.grassLight;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hexA(col, 0.38));
    gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Ділянки, що зливаються в одну форму.
  const groups = new Map<string, [number, number][]>();
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const grp = GROUP[at(map, i, j)!];
      if (!grp) continue;
      if (!groups.has(grp)) groups.set(grp, []);
      groups.get(grp)!.push([i, j]);
    }
  }
  const order = ['road', 'sand', 'water', 'pave', 'path', 'cobble', 'bed'];
  for (const grp of order) {
    const cells = groups.get(grp);
    if (!cells) continue;
    const same = (i: number, j: number) => GROUP[at(map, i, j) ?? 'g'] === grp || at(map, i, j) === undefined;
    const fill = grp === 'path' ? P.dirt : grp === 'cobble' ? '#b9ab98' : grp === 'pave' ? '#cfc6b6' : grp === 'bed' ? '#6e4a32' : grp === 'water' ? P.water : grp === 'sand' ? '#efd9a0' : '#5a5f6a';
    // Форма: клітинки з заокругленими зовнішніми кутами, з м'якою тінню-краєм.
    g.save();
    g.shadowColor = 'rgba(40,30,20,0.28)';
    g.shadowBlur = 2.2 * res;
    g.shadowOffsetY = 0.6 * res;
    g.fillStyle = fill;
    for (const [i, j] of cells) {
      const x = i * TILE;
      const y = j * TILE;
      const n = same(i, j - 1);
      const s = same(i, j + 1);
      const w = same(i - 1, j);
      const e = same(i + 1, j);
      const R = 6;
      rr(g, x - 0.3, y - 0.3, TILE + 0.6, TILE + 0.6, [!n && !w ? R : 0, !n && !e ? R : 0, !s && !e ? R : 0, !s && !w ? R : 0]);
      g.fill();
    }
    g.restore();
    for (const [i, j] of cells) texture(g, grp, i, j, P, season, same);
  }

  // Квіти й травинки поверх трави.
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = at(map, i, j);
      if (t !== 'g' && t !== 'G') continue;
      grassDetail(g, i, j, P, t === 'G');
    }
  }
  // Паркан і живопліт — поверх землі.
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = at(map, i, j);
      if (t === 'F') fence(g, map, i, j, P);
      if (t === 'h') hedge(g, i, j, P);
      if (t === 'r') rail(g, i, j);
    }
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function texture(g: Ctx, grp: string, i: number, j: number, P: SeasonPalette, season: Season, same: (i: number, j: number) => boolean): void {
  const x = i * TILE;
  const y = j * TILE;
  if (grp === 'path') {
    for (let k = 0; k < 3; k += 1) {
      const px = x + 2 + hash01(i, j, k) * 12;
      const py = y + 2 + hash01(i, j, k + 7) * 12;
      oval(g, px, py, 1.2 + hash01(i, j, k + 3), 0.8, shade(P.dirt, k % 2 ? 0.12 : -0.14), null);
    }
    if (hash01(i, j, 40) < 0.4) {
      const gr = g.createRadialGradient(x + 8, y + 8, 0, x + 8, y + 8, 9);
      gr.addColorStop(0, hexA(shade(P.dirt, -0.1), 0.35));
      gr.addColorStop(1, hexA(P.dirt, 0));
      g.fillStyle = gr;
      g.fillRect(x - 1, y - 1, TILE + 2, TILE + 2);
    }
  } else if (grp === 'cobble') {
    // Округлі камені рядами, зі світлим верхом.
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const off = r % 2 ? 2.6 : 0;
        const cx = x + 2.8 + c * 5.3 + off + (hash01(i * 3 + c, j * 3 + r, 2) - 0.5) * 1.2;
        const cy = y + 2.8 + r * 5.3 + (hash01(i * 3 + c, j * 3 + r, 3) - 0.5) * 1.2;
        if (cx > x + TILE - 1 && !same(i + 1, j)) continue;
        const tone = shade('#c7b9a6', (hash01(i * 3 + c, j * 3 + r, 4) - 0.5) * 0.18);
        oval(g, cx, cy, 2.3, 2, tone, shade(tone, -0.3), 0.4);
        oval(g, cx - 0.4, cy - 0.6, 1.2, 0.7, shade(tone, 0.18), null);
      }
    }
  } else if (grp === 'pave') {
    g.strokeStyle = 'rgba(90,80,70,0.35)';
    g.lineWidth = 0.4;
    g.strokeRect(x + 0.5, y + 0.5, 7.5, 7.5);
    g.strokeRect(x + 8, y + 8, 7.5, 7.5);
  } else if (grp === 'bed') {
    // Грядка: борозни й рядки сходів.
    for (let r = 0; r < 4; r += 1) {
      const by = y + 2 + r * 4;
      line(g, x + 0.5, by + 2.2, x + TILE - 0.5, by + 2.2, 'rgba(40,24,16,0.45)', 0.8);
      line(g, x + 0.5, by + 0.8, x + TILE - 0.5, by + 0.8, 'rgba(160,110,80,0.35)', 0.6);
      if (season === 'winter') continue;
      for (let k = 0; k < 3; k += 1) {
        const sx = x + 2.5 + k * 5.2 + (r % 2) * 2;
        const leaf = season === 'autumn' ? '#9a8a3a' : '#5aa14a';
        oval(g, sx - 0.9, by + 0.6, 1.2, 0.6, leaf, null, 0, -0.6);
        oval(g, sx + 0.9, by + 0.6, 1.2, 0.6, shade(leaf, 0.15), null, 0, 0.6);
      }
    }
  } else if (grp === 'water') {
    line(g, x + 3, y + 5, x + 8, y + 5, P.waterLight, 0.6);
    line(g, x + 9, y + 11, x + 13, y + 11, P.waterLight, 0.6);
  } else if (grp === 'sand') {
    for (let k = 0; k < 4; k += 1) circle(g, x + hash01(i, j, k) * 16, y + hash01(i, j, k + 5) * 16, 0.4, '#d9bf80', null);
  } else if (grp === 'road') {
    if (hash01(i, j, 9) < 0.2) line(g, x + 4, y + 8, x + 12, y + 8, 'rgba(255,255,255,0.25)', 0.8);
  }
}

function grassDetail(g: Ctx, i: number, j: number, P: SeasonPalette, rich: boolean): void {
  const x = i * TILE;
  const y = j * TILE;
  if (P.snow) {
    if (hash01(i, j, 5) < 0.2) oval(g, x + 8, y + 9, 5, 1.6, 'rgba(200,215,235,0.6)', null);
    return;
  }
  // Пучки травинок: три вигнуті листочки.
  const tufts = rich ? 2 : hash01(i, j, 11) < 0.55 ? 1 : 0;
  for (let k = 0; k < tufts; k += 1) {
    const bx = x + 2 + hash01(i, j, k + 20) * 12;
    const by = y + 4 + hash01(i, j, k + 30) * 10;
    g.strokeStyle = P.blade;
    g.lineWidth = 0.7;
    for (const d of [-1.6, 0, 1.6]) {
      g.beginPath();
      g.moveTo(bx + d * 0.4, by);
      g.quadraticCurveTo(bx + d * 0.6, by - 2.2, bx + d, by - 3.2 + Math.abs(d) * 0.4);
      g.stroke();
    }
  }
  // Квіточки.
  const nFlowers = rich ? 2 : hash01(i, j, 13) < 0.1 ? 1 : 0;
  for (let k = 0; k < nFlowers; k += 1) {
    const fx = x + 2 + hash01(i, j, k + 50) * 12;
    const fy = y + 2 + hash01(i, j, k + 60) * 12;
    const col = P.flowers[Math.floor(hash01(i, j, k + 70) * P.flowers.length)]!;
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2;
      circle(g, fx + Math.cos(a) * 1, fy + Math.sin(a) * 1, 0.8, col, null);
    }
    circle(g, fx, fy, 0.55, '#f6c14e', null);
  }
}

function fence(g: Ctx, map: GameMap, i: number, j: number, P: SeasonPalette): void {
  const x = i * TILE;
  const y = j * TILE;
  const wood = '#b48a5a';
  const isF = (a: number, b: number) => at(map, a, b) === 'F';
  // Жердини до сусідніх секцій.
  if (isF(i + 1, j)) {
    box(g, x + 8, y + 5, 16, 2, 0.8, shade(wood, 0.05), shade(wood, -0.45), 0.5);
    box(g, x + 8, y + 9.5, 16, 2, 0.8, wood, shade(wood, -0.45), 0.5);
  }
  if (isF(i, j + 1)) box(g, x + 7, y + 8, 2, 16, 0.8, shade(wood, -0.05), shade(wood, -0.45), 0.5);
  // Стовпчик із загостреним верхом.
  g.save();
  g.shadowColor = 'rgba(40,26,20,0.3)';
  g.shadowBlur = 1.2;
  g.shadowOffsetX = 0.8;
  g.shadowOffsetY = 0.8;
  rr(g, x + 6.2, y + 2.5, 3.6, 12, [1.8, 1.8, 0.6, 0.6]);
  g.fillStyle = shade(wood, 0.08);
  g.fill();
  g.restore();
  rr(g, x + 6.2, y + 2.5, 3.6, 12, [1.8, 1.8, 0.6, 0.6]);
  g.strokeStyle = shade(wood, -0.5);
  g.lineWidth = 0.5;
  g.stroke();
  line(g, x + 7.2, y + 4, x + 7.2, y + 13, shade(wood, 0.3), 0.5);
  if (P.snow) box(g, x + 6, y + 2, 4, 1.6, 0.8, '#ffffff', null);
}

function hedge(g: Ctx, i: number, j: number, P: SeasonPalette): void {
  const x = i * TILE;
  const y = j * TILE;
  for (const [dx, dy, r] of [[4, 9, 5], [12, 9, 5], [8, 6, 5.5]] as const) circle(g, x + dx, y + dy, r, P.leafDark, shade(P.leafDark, -0.35), 0.5);
  for (const [dx, dy] of [[6, 5], [11, 6]] as const) circle(g, x + dx, y + dy, 2, P.leafLight, null);
}

function rail(g: Ctx, i: number, j: number): void {
  const x = i * TILE;
  const y = j * TILE;
  g.fillStyle = '#9a8a78';
  g.fillRect(x, y, TILE, TILE);
  for (let k = 0; k < 4; k += 1) box(g, x + 1 + k * 4, y + 2, 2.6, 12, 0.5, '#7a5a3a', null);
  box(g, x, y + 4, TILE, 1.5, 0.4, '#d8dde3', null);
  box(g, x, y + 10.5, TILE, 1.5, 0.4, '#d8dde3', null);
}

// ------------------------------------------------------------
// Усередині: підлога, стіни, товщина стін між кімнатами.
// ------------------------------------------------------------
function interior(g: Ctx, map: GameMap): void {
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = at(map, i, j)!;
      const x = i * TILE;
      const y = j * TILE;
      switch (t) {
        case 'f': plank(g, x, y, i, j); break;
        case 't': tileFloor(g, x, y, i, j); break;
        case 'k': carpet(g, x, y); break;
        case 'e': earth(g, x, y, i, j); break;
        case 'W': wallpaper(g, map, x, y, i, j); break;
        case 'S': stoneWall(g, map, x, y, i, j); break;
        case 'x': voidOrWall(g, map, x, y, i, j); break;
        default: g.fillStyle = '#c9925a'; g.fillRect(x, y, TILE, TILE);
      }
    }
  }
  // Глибина: тінь від стіни на підлогу й від товщі стін обабіч.
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = at(map, i, j);
      if (t !== 'f' && t !== 't' && t !== 'k' && t !== 'e') continue;
      const x = i * TILE;
      const y = j * TILE;
      const up = at(map, i, j - 1);
      if (up === 'W' || up === 'S' || up === 'x') {
        const gr = g.createLinearGradient(0, y, 0, y + 7);
        gr.addColorStop(0, 'rgba(50,30,30,0.32)');
        gr.addColorStop(1, 'rgba(50,30,30,0)');
        g.fillStyle = gr;
        g.fillRect(x, y, TILE, 7);
      }
      if (at(map, i - 1, j) === 'x') {
        const gr = g.createLinearGradient(x, 0, x + 4, 0);
        gr.addColorStop(0, 'rgba(50,30,30,0.28)');
        gr.addColorStop(1, 'rgba(50,30,30,0)');
        g.fillStyle = gr;
        g.fillRect(x, y, 4, TILE);
      }
      if (at(map, i + 1, j) === 'x') {
        const gr = g.createLinearGradient(x + TILE, 0, x + TILE - 4, 0);
        gr.addColorStop(0, 'rgba(50,30,30,0.2)');
        gr.addColorStop(1, 'rgba(50,30,30,0)');
        g.fillStyle = gr;
        g.fillRect(x + TILE - 4, y, 4, TILE);
      }
    }
  }
}

/** Дошки підлоги: тепле дерево, дошки різного тону, шви вразбіг. */
function plank(g: Ctx, x: number, y: number, i: number, j: number): void {
  const base = '#cf9c66';
  for (let r = 0; r < 4; r += 1) {
    const by = y + r * 4;
    // Довгі дошки: шов раз на кілька клітинок, вразбіг по рядах.
    const run = Math.floor((i + r * 3 + (j * 7) % 5) / 3);
    const tone = shade(base, (hash01(run, j * 4 + r, 1) - 0.5) * 0.14);
    const gr = g.createLinearGradient(0, by, 0, by + 4);
    gr.addColorStop(0, shade(tone, 0.08));
    gr.addColorStop(1, shade(tone, -0.05));
    g.fillStyle = gr;
    g.fillRect(x, by, TILE, 4);
    g.fillStyle = shade(base, -0.3);
    g.fillRect(x, by + 3.6, TILE, 0.4);
    if ((i + r * 3 + (j * 7) % 5) % 3 === 0) g.fillRect(x + 0.2, by, 0.4, 3.6);
    // Сучок.
    if (hash01(i, j * 4 + r, 5) < 0.06) oval(g, x + 3 + hash01(i, j, r) * 10, by + 1.8, 1, 0.6, shade(base, -0.22), null);
  }
}

function tileFloor(g: Ctx, x: number, y: number, i: number, j: number): void {
  const a = (i + j) % 2 === 0 ? '#ece6da' : '#bccbda';
  box(g, x + 0.3, y + 0.3, TILE - 0.6, TILE - 0.6, 1.2, a, shade(a, -0.15), 0.4);
}

function carpet(g: Ctx, x: number, y: number): void {
  g.fillStyle = '#9a6a8a';
  g.fillRect(x, y, TILE, TILE);
}

function earth(g: Ctx, x: number, y: number, i: number, j: number): void {
  const base = '#6e5a46';
  g.fillStyle = base;
  g.fillRect(x, y, TILE, TILE);
  const gr = g.createRadialGradient(x + 8, y + 8, 0, x + 8, y + 8, 12);
  gr.addColorStop(0, hexA(shade(base, 0.08), 0.6));
  gr.addColorStop(1, hexA(base, 0));
  g.fillStyle = gr;
  g.fillRect(x, y, TILE, TILE);
  for (let k = 0; k < 3; k += 1) oval(g, x + 2 + hash01(i, j, k) * 12, y + 2 + hash01(i, j, k + 4) * 12, 1.3, 0.9, k ? '#857462' : '#5a4838', null);
}

/** Шпалери: теплий крем із дрібним квітковим візерунком, карниз і плінтус. */
function wallpaper(g: Ctx, map: GameMap, x: number, y: number, i: number, j: number): void {
  const paper = '#efe3c8';
  g.fillStyle = paper;
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = mix(paper, '#d8c49c', 0.5);
  for (let k = 2; k < TILE; k += 8) g.fillRect(x + k, y, 0.6, TILE);
  if ((i + j) % 2 === 0) {
    circle(g, x + 6, y + 6, 0.9, '#e2a4a4', null);
    circle(g, x + 6, y + 6, 0.35, '#f6d98a', null);
  }
  if (at(map, i, j - 1) !== 'W') {
    // Карниз згори.
    g.fillStyle = '#8a5a3a';
    g.fillRect(x, y, TILE, 2.2);
    g.fillStyle = '#b07a52';
    g.fillRect(x, y + 2.2, TILE, 0.8);
  }
  const below = at(map, i, j + 1);
  if (below && below !== 'W' && below !== 'x') {
    // Плінтус.
    g.fillStyle = '#9a6a42';
    g.fillRect(x, y + 12.5, TILE, 3.5);
    g.fillStyle = '#c08a5a';
    g.fillRect(x, y + 12.5, TILE, 0.8);
  } else {
    const gr = g.createLinearGradient(0, y + 10, 0, y + 16);
    gr.addColorStop(0, 'rgba(120,90,60,0)');
    gr.addColorStop(1, 'rgba(120,90,60,0.12)');
    g.fillStyle = gr;
    g.fillRect(x, y + 10, TILE, 6);
  }
}

function stoneWall(g: Ctx, map: GameMap, x: number, y: number, i: number, j: number): void {
  g.fillStyle = '#3c332c';
  g.fillRect(x, y, TILE, TILE);
  for (let r = 0; r < 3; r += 1) {
    const off = (j * 3 + r) % 2 ? 0 : 4;
    for (let c = -1; c < 3; c += 1) {
      const sx = x + off + c * 8;
      const tone = shade('#8a7f70', (hash01(i * 4 + c, j * 3 + r, 2) - 0.5) * 0.2);
      g.save();
      g.beginPath();
      g.rect(x, y, TILE, TILE);
      g.clip();
      box(g, sx + 0.4, y + r * 5.3 + 0.4, 7.2, 4.6, 2, tone, shade(tone, -0.45), 0.4);
      oval(g, sx + 3, y + r * 5.3 + 1.6, 2.4, 0.7, shade(tone, 0.16), null);
      g.restore();
    }
  }
  if (at(map, i, j - 1) === undefined) {
    g.fillStyle = '#241c18';
    g.fillRect(x, y, TILE, 2);
  }
}

/** Порожнеча за межами — темна; там, де торкається кімнати, — товща стіни. */
function voidOrWall(g: Ctx, map: GameMap, x: number, y: number, i: number, j: number): void {
  let touches = false;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const t = at(map, i + di, j + dj);
    if (t && t !== 'x') touches = true;
  }
  g.fillStyle = '#1b1420';
  g.fillRect(x, y, TILE, TILE);
  if (!touches) return;
  g.fillStyle = '#6a5048';
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = '#7d6056';
  g.fillRect(x, y, TILE, 1.2);
  // Шов посередині товщі — стіна читається як стіна, а не як прірва.
  g.fillStyle = 'rgba(30,20,20,0.18)';
  g.fillRect(x + 7.6, y, 0.8, TILE);
}
