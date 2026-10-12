// ============================================================
// Деталі землі у 32×32 (ADR-0239, власник 2026-10-06: «більш
// деталізований піксельний варіант»). Основа клітинки — та сама, що в
// 16×16 (`tiles.ts`); тут — те, що з'являється лише тоді, коли піксель
// малюнка вдвічі дрібніший: окремі травинки, конюшина, камінці з
// відблиском, волокна дощок, цвяшки, візерунок шпалер. Ставиться лише
// `dot` — один піксель малюнка (пів світового).
// ============================================================
import { TILE, type GameMap, type Ground } from '../world/types';
import { PALETTES, type SeasonPalette } from './palette';
import { cellHash, dot, mix, rect, shade, type Ctx } from './pixel';

const h01 = (i: number, j: number, k: number) => cellHash(i, j, k + 900) / 4294967296;

// ------------------------------------------------------------
// Трава подвір'я (власник 2026-10-12: «переглянь текстури всього
// подвір'я, покращ їх в 32х32»). У 16×16 трава — рівний колір із
// прямокутними латками й «галочками»; у 32×32 ті самі прямокутники
// читались квадратами, а травинки — розсипом окремих крапок. Тут:
//   • латки тіні й сонця — пороги плавного поля `lawnField`: великі
//     плями з плавним краєм, що тягнуться через кілька клітинок (кругами
//     вони читались бульбашками);
//   • травинки — кущиками з тінню під ними й світлими кінчиками;
//   • квіти — купками різних видів, а не однаковими хрестиками всюди;
//   • узимку — брижі від вітру, іскри й сухі стебла з-під снігу.
// ------------------------------------------------------------

/** Пороги поля `lawnField`: густа тінь, тінь, сонце, яскраве сонце (≈10/15/15/10% трави). */
export const DEEP = 0.66;
export const LUSH = 0.58;
export const SUNNY = 0.4;
export const SUNNIER = 0.33;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Октави поля: крок ґратки в клітинках і вага. */
const OCTAVES = [[3, 0.55], [7, 0.35], [1.25, 0.1]] as const;

const lattice = (a: number, b: number, salt: number) => cellHash(a, b, 4100 + salt) / 4294967296;

function valueNoise(fx: number, fy: number, L: number, salt: number): number {
  const gx = fx / L;
  const gy = fy / L;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = smooth(gx - x0);
  const sy = smooth(gy - y0);
  const top = lattice(x0, y0, salt) + (lattice(x0 + 1, y0, salt) - lattice(x0, y0, salt)) * sx;
  const bot = lattice(x0, y0 + 1, salt) + (lattice(x0 + 1, y0 + 1, salt) - lattice(x0, y0 + 1, salt)) * sx;
  return top + (bot - top) * sy;
}

/**
 * Плавне поле 0..1 над мапою (`fx`, `fy` — у клітинках, дробові): три
 * масштаби (≈3, ≈7 і ≈1 клітинка), тож латки тягнуться через кілька
 * клітинок, а їхній край звивається.
 */
export function lawnField(fx: number, fy: number, salt = 0): number {
  let f = 0;
  OCTAVES.forEach(([L, w], k) => { f += w * valueNoise(fx, fy, L, salt + k); });
  return f;
}

/** Те саме поле з наперед обчисленою ґраткою — для проходу по кожному пікселю мапи. */
export function lawnFieldGrid(cols: number, rows: number, salt = 0): (fx: number, fy: number) => number {
  const octs = OCTAVES.map(([L, w], k) => {
    const nx = Math.floor(cols / L) + 3;
    const ny = Math.floor(rows / L) + 3;
    const v = new Float64Array(nx * ny);
    for (let b = 0; b < ny; b += 1) for (let a = 0; a < nx; a += 1) v[b * nx + a] = lattice(a, b, salt + k);
    return { L, w, nx, v };
  });
  return (fx, fy) => {
    let f = 0;
    for (const { L, w, nx, v } of octs) {
      const gx = fx / L;
      const gy = fy / L;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const sx = smooth(gx - x0);
      const sy = smooth(gy - y0);
      const k = y0 * nx + x0;
      const top = v[k]! + (v[k + 1]! - v[k]!) * sx;
      const bot = v[k + nx]! + (v[k + nx + 1]! - v[k + nx]!) * sx;
      f += w * (top + (bot - top) * sy);
    }
    return f;
  };
}

/** Рівень латки за полем: 0 густа тінь, 1 тінь, 2 звичайна трава, 3 сонце, 4 яскраве сонце. */
export function lawnLevel(f: number): number {
  return f > DEEP ? 0 : f > LUSH ? 1 : f < SUNNIER ? 4 : f < SUNNY ? 3 : 2;
}

/**
 * Земля, на якій лежать латки й ростуть кущики: трава, трава з квітами й
 * трава під парканом (інакше латка обривалася б рівною смугою біля тину).
 */
const LAWN: ReadonlySet<Ground> = new Set<Ground>(['g', 'G', 'F']);

/**
 * Трава всієї мапи в 32×32 — окремим проходом після клітинок: латки
 * переходять через межі клітинок, а кущики й квіти мають лягти поверх латок.
 * Латки — рядками пікселів малюнка: кожен рядок ділиться на відрізки
 * одного рівня поля, лише по клітинках трави.
 */
export function lawnHd(g: Ctx, map: GameMap, P: SeasonPalette): void {
  const tones: readonly (string | null)[] = P.snow
    ? [mix(P.grass, '#b9cbe4', 0.42), mix(P.grass, '#c3d2e8', 0.22), null, '#f8fbff', '#ffffff']
    : [mix(P.grass, P.grassDark, 0.9), mix(P.grass, P.grassDark, 0.45), null, mix(P.grass, P.grassLight, 0.4), mix(P.grass, P.grassLight, 0.72)];
  const field = lawnFieldGrid(map.w, map.h);
  const W = map.w * TILE;
  for (let y = 0; y < map.h * TILE; y += 0.5) {
    const row = map.ground[Math.floor(y / TILE)]!;
    const fy = (y + 0.25) / TILE;
    let start = 0;
    let level = 2;
    for (let x = 0; x <= W; x += 0.5) {
      let lv = 2;
      // Крихта шуму біля межі рівнів — край латки трав'янистий, а не лекальний.
      if (x < W && LAWN.has(row[Math.floor(x / TILE)]!)) lv = lawnLevel(field((x + 0.25) / TILE, fy) + ((cellHash(x * 2, y * 2, 4700) & 15) - 7.5) * 0.0012);
      if (lv === level) continue;
      const tone = tones[level];
      if (tone) rect(g, start, y, x - start, 0.5, tone);
      start = x;
      level = lv;
    }
  }
  for (let j = 0; j < map.h; j += 1) {
    for (let i = 0; i < map.w; i += 1) {
      const t = map.ground[j]![i]!;
      if (!LAWN.has(t)) continue;
      grassHd(g, i * TILE, j * TILE, i, j, P, t === 'G' || (t === 'g' && cellHash(i, j, 77) % 11 === 0), lawnField(i + 0.5, j + 0.5));
    }
  }
}

/** Кущик трави: 3–5 травинок віялом, середня найвища, тінь під ним, кінчики на сонці. */
function tuft(g: Ctx, x: number, y: number, bits: number, P: SeasonPalette): void {
  const blades = 3 + (bits % 3);
  const left = x - (blades - 1) / 4;
  rect(g, left - 0.5, y + 0.5, blades / 2 + 0.5, 0.5, 'rgba(28,48,20,0.28)');
  for (let b = 0; b < blades; b += 1) {
    const bx = left + b * 0.5;
    const off = Math.abs(b - (blades - 1) / 2);
    const tall = 4 - Math.min(2, Math.round(off)) - ((bits >>> (2 + b)) & 1);
    const lean = b * 2 < blades - 1 ? -0.5 : b * 2 > blades - 1 ? 0.5 : 0;
    for (let s = 0; s < tall; s += 1) {
      const tip = s === tall - 1;
      dot(g, bx + (tip && tall > 2 ? lean : 0), y - s * 0.5, tip ? P.grassLight : s === 0 ? shade(P.blade, -0.15) : P.blade);
    }
  }
}

/** Квітка в траві: стебло з листком і голівка одного з трьох видів. */
function meadowFlower(g: Ctx, fx: number, fy: number, c: string, kind: number, P: SeasonPalette): void {
  dot(g, fx, fy + 1, P.blade);
  dot(g, fx, fy + 1.5, P.blade);
  dot(g, fx, fy + 2, P.blade);
  dot(g, fx + 0.5, fy + 2, P.grassLight);
  const yellow = c === '#f6d55c' || c === '#f2c14e';
  const low = shade(c, -0.15);
  if (kind === 0) {
    // Ромашка: розетка пелюсток 5×5 пікселів малюнка зі серединкою.
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0], [0.5, 0], [0, -0.5]] as const) dot(g, fx + dx, fy + dy, c);
    for (const [dx, dy] of [[-0.5, 0.5], [0.5, 0.5], [0, 0.5]] as const) dot(g, fx + dx, fy + dy, low);
    dot(g, fx, fy, yellow ? '#c97a2a' : '#f6d55c');
  } else if (kind === 1) {
    // Кругла голівка 3×3 з відблиском угорі ліворуч.
    for (const [dx, dy] of [[0, -0.5], [-0.5, 0], [0, 0], [0.5, 0], [0.5, -0.5]] as const) dot(g, fx + dx, fy + dy, c);
    dot(g, fx - 0.5, fy - 0.5, shade(c, 0.3));
    for (const [dx, dy] of [[-0.5, 0.5], [0, 0.5], [0.5, 0.5]] as const) dot(g, fx + dx, fy + dy, low);
  } else {
    // Дзвоники парою на одному стеблі.
    dot(g, fx - 0.5, fy + 0.5, c);
    dot(g, fx - 0.5, fy, shade(c, 0.2));
    dot(g, fx + 0.5, fy, c);
    dot(g, fx + 0.5, fy - 0.5, shade(c, 0.2));
    dot(g, fx + 0.5, fy + 0.5, low);
  }
}

/** Сніг: брижі від вітру з блакитною тінню, іскри, сухі стебла там, де влітку квіти. */
function snowHd(g: Ctx, x: number, y: number, i: number, j: number, flowers: boolean, f: number): void {
  const n = f > LUSH ? 3 : 2;
  for (let k = 0; k < n; k += 1) {
    const hh = cellHash(i, j, 4600 + k);
    const rx = x + 1 + (hh % 20) / 2;
    const ry = y + 2 + ((hh >>> 6) % 24) / 2;
    const len = 2 + ((hh >>> 12) % 3);
    rect(g, rx, ry, len, 0.5, '#ffffff');
    rect(g, rx + 0.5, ry + 0.5, len - 0.5, 0.5, '#d3deee');
  }
  if (h01(i, j, 47) < 0.4) dot(g, x + 2 + Math.floor(h01(i, j, 48) * 24) / 2, y + 2 + Math.floor(h01(i, j, 49) * 24) / 2, '#ffffff');
  if (!flowers) return;
  const m = h01(i, j, 50) < 0.45 ? 1 : 0;
  for (let k = 0; k < m; k += 1) {
    const sx = x + 2 + Math.floor(h01(i, j, 51 + k) * 24) / 2;
    const sy = y + 4 + Math.floor(h01(i, j, 53 + k) * 20) / 2;
    dot(g, sx + 0.5, sy - 0.5, '#6e5a38');
    dot(g, sx, sy, '#8a7048');
    dot(g, sx, sy + 0.5, '#a88a5a');
    dot(g, sx, sy + 1, '#a88a5a');
    rect(g, sx - 0.5, sy + 1.5, 1.5, 0.5, '#d3deee');
  }
}

/**
 * Трава клітинки в 32×32: кущики (густіше в тіні, рідше на сонці),
 * конюшина в тінистих латках, квіти купками. `f` — поле `lawnField` тут.
 */
export function grassHd(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette, flowers: boolean, f = 0.5): void {
  if (P.snow) { snowHd(g, x, y, i, j, flowers, f); return; }
  const n = f > LUSH ? 6 : f < SUNNY ? 2 : 4;
  for (let k = 0; k < n; k += 1) {
    const hh = cellHash(i, j, 4400 + k);
    tuft(g, x + 1.5 + (hh % 26) / 2, y + 3 + ((hh >>> 6) % 24) / 2, hh >>> 12, P);
  }
  // Конюшина: три листочки й темна серединка, по дві-три поруч.
  if (f > LUSH - 0.05 && h01(i, j, 60) < 0.4) {
    const cx = x + 3 + Math.floor(h01(i, j, 61) * 18) / 2;
    const cy = y + 3 + Math.floor(h01(i, j, 62) * 18) / 2;
    for (const [dx, dy] of [[0, 0], [1.5, 0.5], [0.5, 1.5]] as const) {
      dot(g, cx + dx, cy + dy, P.grassLight);
      dot(g, cx + dx - 0.5, cy + dy + 0.5, P.grassLight);
      dot(g, cx + dx + 0.5, cy + dy + 0.5, P.grassLight);
      dot(g, cx + dx, cy + dy + 0.5, P.grassDark);
    }
  }
  if (!flowers) return;
  // Квіти купками: де поле квітів високе — до шести на клітинку, де низьке —
  // одна-жодної (рівний розсип по всій галявині читався конфеті).
  const count = Math.max(0, Math.round((lawnField(i + 0.5, j + 0.5, 9) - 0.2) * 12));
  for (let k = 0; k < count; k += 1) {
    const hh = cellHash(i, j, 4500 + k);
    const c = P.flowers[(hh >>> 3) % P.flowers.length]!;
    meadowFlower(g, x + 1.5 + (hh % 24) / 2, y + 1.5 + ((hh >>> 8) % 22) / 2, c, (hh >>> 16) % 3, P);
  }
}

/**
 * Стежка: крихти ґрунту парами (поодинокі крапки читались шумом), камінці
 * зі світлом угорі, тінню внизу й тінькою на землі, тріщини посухи,
 * восени — опале листя.
 */
export function dirtHd(g: Ctx, x: number, y: number, i: number, j: number, base: string, P: SeasonPalette): void {
  for (let k = 0; k < 6; k += 1) {
    const px = x + Math.floor(h01(i, j, k) * 30) / 2;
    const py = y + Math.floor(h01(i, j, k + 10) * 30) / 2;
    const c = k % 3 ? shade(base, -0.12) : shade(base, 0.12);
    dot(g, px, py, c);
    if (k % 2) dot(g, px + 0.5, py, c);
  }
  const n = Math.floor(h01(i, j, 30) * 3);
  for (let k = 0; k < n; k += 1) {
    const px = x + 1 + Math.floor(h01(i, j, k + 31) * 26) / 2;
    const py = y + 1 + Math.floor(h01(i, j, k + 41) * 26) / 2;
    const stone = mix(base, k % 2 ? '#8a8478' : '#a89c88', 0.65);
    const w = 1 + (k % 2) * 0.5;
    rect(g, px + 0.5, py + 1, w, 0.5, shade(base, -0.2));
    rect(g, px, py, w, 1, stone);
    dot(g, px, py, shade(stone, 0.25));
    dot(g, px + w - 0.5, py + 0.5, shade(stone, -0.25));
  }
  if (!P.snow && h01(i, j, 50) < 0.12) {
    let cx = x + 3 + Math.floor(h01(i, j, 51) * 16) / 2;
    let cy = y + 3 + Math.floor(h01(i, j, 52) * 16) / 2;
    for (let s = 0; s < 6; s += 1) {
      dot(g, cx, cy, shade(base, -0.28));
      if (s === 3) dot(g, cx, cy + 0.5, shade(base, -0.2));
      cx += 0.5;
      cy += ((cellHash(i, j, 960 + s) % 3) - 1) * 0.5;
    }
  }
  if (P === PALETTES.autumn && h01(i, j, 70) < 0.35) {
    const lx = x + 2 + Math.floor(h01(i, j, 71) * 24) / 2;
    const ly = y + 2 + Math.floor(h01(i, j, 72) * 24) / 2;
    const c = h01(i, j, 73) < 0.5 ? P.leaf : P.leafDark;
    dot(g, lx, ly, c);
    dot(g, lx + 0.5, ly, c);
    dot(g, lx + 0.5, ly + 0.5, shade(c, -0.25));
    dot(g, lx - 0.5, ly + 0.5, shade(c, 0.2));
  }
}

/** Травинки, що звисають за рваний край трави на стежку (32×32). */
export function fringeTipHd(g: Ctx, x: number, y: number, P: SeasonPalette): void {
  dot(g, x, y, P.snow ? P.grass : shade(P.grass, -0.1));
}

/**
 * Бруківка: кожен камінь округлий (кути — колір розчину), освітлений край
 * згори-зліва, тінь знизу, інколи тріщинка; у швах — мох, взимку — сніг.
 */
export function cobbleHd(g: Ctx, x: number, y: number, i: number, j: number, stones: readonly (readonly [number, number, number, number])[], mortar: string, snow: boolean): void {
  stones.forEach(([sx, sy, sw, sh], k) => {
    const hh = h01(i, j, k + 100);
    const x0 = x + sx;
    const y0 = y + sy;
    const x1 = x0 + sw - 1.5;
    const y1 = y0 + sh - 1.5;
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) dot(g, cx, cy, mortar);
    dot(g, x0 + 0.5, y0 + 0.5, 'rgba(255,255,255,0.35)');
    dot(g, x0 + 1, y0 + 0.5, 'rgba(255,255,255,0.2)');
    dot(g, x1 - 0.5, y1, 'rgba(40,30,20,0.35)');
    if (hh < 0.35) {
      const cx = x0 + 1 + Math.floor(hh * 2 * (sw - 2)) / 2;
      dot(g, cx, y0 + 1.5, 'rgba(60,50,40,0.4)');
      dot(g, cx + 0.5, y0 + 2, 'rgba(60,50,40,0.4)');
    }
    if (!snow && h01(i, j, k + 120) < 0.18) {
      dot(g, x1 + 0.5, y1 + 0.5, '#6f8a3a');
      dot(g, x1 + 1, y1 + 0.5, '#8aa44a');
    }
  });
}

/** Грядка: грудочки ґрунту й листочки сходів парами. */
export function bedHd(g: Ctx, x: number, y: number, i: number, j: number, soil: string, leaf: string): void {
  for (let k = 0; k < 8; k += 1) dot(g, x + Math.floor(h01(i, j, k) * 30) / 2, y + Math.floor(h01(i, j, k + 12) * 30) / 2, k % 2 ? shade(soil, 0.16) : shade(soil, -0.2));
  for (let r = 0; r < 16; r += 8) {
    for (let c = 2; c < 16; c += 5) {
      if (h01(i * 3 + c, j * 2 + r, 7) < 0.3) continue;
      dot(g, x + c - 0.5, y + r + 0.5, shade(leaf, 0.25));
      dot(g, x + c + 1, y + r + 0.5, shade(leaf, 0.25));
    }
  }
}

/**
 * Паркан у 32×32: стовпчик із тонким відблиском ліворуч і тінню праворуч,
 * заокругленим верхом і світлим зрізом, волокна рисками (не цятками),
 * сучки, цвяхи там, де тримається жердина, мох біля землі; жердини — зі
 * світлим верхом, тінню знизу й волокнами між стовпчиками.
 */
export function fenceHd(g: Ctx, x: number, y: number, i: number, j: number, wood: string, P: SeasonPalette): void {
  const post = shade(wood, -0.1);
  // Жердини — лише між стовпчиками: стовпчики стоять перед ними.
  const spans = [[0, 1], [4, 9], [12, 16]] as const;
  for (const [ry, light] of [[5, false], [10, true]] as const) {
    for (const [a, b] of spans) {
      if (light) rect(g, x + a, y + ry, b - a, 0.5, shade(wood, 0.2));
      else rect(g, x + a, y + ry + 0.5, b - a, 0.5, wood);
      rect(g, x + a, y + ry + 1.5, b - a, 0.5, shade(wood, -0.22));
      if (b - a < 4) continue;
      const hh = cellHash(i * 4 + a, j * 2 + ry, 930);
      const len = 1.5 + (hh % 3) * 0.5;
      const gx = x + a + 0.5 + ((hh >>> 4) % Math.max(1, (b - a - len - 1) * 2)) / 2;
      rect(g, gx, y + ry + 1, len, 0.5, shade(wood, -0.14));
    }
  }
  if (!P.snow) for (const [a, b] of spans) rect(g, x + a, y + 12, b - a, 0.5, 'rgba(20,30,20,0.18)');
  // Стовпчики.
  for (const [n, pxl] of [[0, 1], [1, 9]] as const) {
    const hh = cellHash(i * 2 + n, j, 920);
    const px = x + pxl;
    rect(g, px + 0.5, y + 2, 0.5, 12, post);
    rect(g, px + 2.5, y + 2, 0.5, 12, shade(wood, -0.32));
    if (!P.snow) {
      dot(g, px, y + 2, P.grass);
      dot(g, px + 2.5, y + 2, P.grass);
      rect(g, px + 0.5, y + 2, 2, 0.5, mix(wood, '#f0d6a8', 0.45));
    }
    for (let k = 0; k < 2; k += 1) {
      const r = cellHash(i * 2 + n, j * 3 + k, 921);
      const gx = px + 1 + (r % 3) * 0.5;
      const gy = y + 3.5 + ((r >>> 3) % 12) / 2;
      rect(g, gx, gy, 0.5, 1.5 + ((r >>> 8) % 3) * 0.5, shade(wood, -0.24));
    }
    if (hh % 4 === 0) {
      dot(g, px + 1.5, y + 8.5, shade(wood, -0.42));
      dot(g, px + 1.5, y + 8, shade(wood, -0.18));
    }
    for (const ny of [6, 11]) {
      dot(g, px + 1.5, y + ny, '#4a4a52');
      dot(g, px + 1, y + ny - 0.5, '#a0a0a8');
    }
    if (!P.snow && hh % 3 === 0) {
      dot(g, px + 0.5, y + 13.5, '#6f8a3a');
      dot(g, px + 1, y + 13.5, '#8aa44a');
      dot(g, px + 1, y + 13, '#6f8a3a');
    }
  }
}

/** Дошки підлоги: волокна вздовж дошки, сучки, цвяшки біля швів. */
export function floorHd(g: Ctx, x: number, y: number, i: number, j: number, base: string): void {
  for (let r = 0; r < 4; r += 1) {
    const by = y + r * 4;
    for (let k = 0; k < 3; k += 1) {
      const gx = x + Math.floor(h01(i, j * 4 + r, k) * 26) / 2;
      const gy = by + 1 + Math.floor(h01(i, j * 4 + r, k + 5) * 4) / 2;
      dot(g, gx, gy, shade(base, -0.12));
      dot(g, gx + 0.5, gy, shade(base, -0.12));
      dot(g, gx + 1, gy, shade(base, -0.08));
    }
    dot(g, x + 1, by + 0.5, shade(base, 0.12));
    if (h01(i, j * 4 + r, 20) < 0.12) {
      const kx = x + 3 + Math.floor(h01(i, j * 4 + r, 21) * 18) / 2;
      dot(g, kx, by + 1.5, shade(base, -0.3));
      dot(g, kx + 0.5, by + 1.5, shade(base, -0.22));
    }
    if ((i + r * 3 + (j * 7) % 5) % 3 === 0) {
      dot(g, x + 1, by + 1, '#6a5a50');
      dot(g, x + 1, by + 2.5, '#6a5a50');
    }
  }
}

/** Шпалери: дрібна квіточка й листочки замість одного пікселя. */
export function wallpaperHd(g: Ctx, x: number, y: number, i: number, j: number): void {
  if ((i + j) % 2 !== 0) return;
  const cx = x + 4;
  const cy = y + 6;
  for (const [dx, dy] of [[0, -0.5], [-0.5, 0], [0.5, 0], [0, 0.5]] as const) dot(g, cx + dx, cy + dy, '#d98a8a');
  dot(g, cx, cy, '#f6d98a');
  dot(g, cx - 1, cy + 1, '#8fae7a');
  dot(g, cx + 1, cy + 1, '#8fae7a');
  dot(g, x + 11.5, y + 12, '#8ab0d9');
  dot(g, x + 12, y + 11.5, '#8ab0d9');
}

/** Утоптана земля погреба: крихти й вологі плями. */
export function earthHd(g: Ctx, x: number, y: number, i: number, j: number, base: string): void {
  for (let k = 0; k < 10; k += 1) dot(g, x + Math.floor(h01(i, j, k) * 30) / 2, y + Math.floor(h01(i, j, k + 15) * 30) / 2, k % 3 ? shade(base, -0.14) : shade(base, 0.16));
}

/** Фарбовані дошки веранди: волокна крізь фарбу, подряпини до дерева. */
export function paintedFloorHd(g: Ctx, x: number, y: number, i: number, j: number, base: string): void {
  for (let r = 0; r < 4; r += 1) {
    const by = y + r * 4;
    for (let k = 0; k < 3; k += 1) {
      const gx = x + Math.floor(h01(i, j * 4 + r, k + 30) * 26) / 2;
      const gy = by + 1 + Math.floor(h01(i, j * 4 + r, k + 35) * 4) / 2;
      dot(g, gx, gy, shade(base, -0.1));
      dot(g, gx + 0.5, gy, shade(base, -0.1));
    }
    dot(g, x + 1, by + 0.5, shade(base, 0.12));
    if (h01(i, j * 4 + r, 50) < 0.2) dot(g, x + 2 + Math.floor(h01(i, j * 4 + r, 51) * 22) / 2, by + 1.5, '#c99a6a');
  }
}

/** Глиняна долівка: піщинки й світлі мазки, ніби від долоні. */
export function clayFloorHd(g: Ctx, x: number, y: number, i: number, j: number, base: string): void {
  for (let k = 0; k < 10; k += 1) dot(g, x + Math.floor(h01(i, j, k + 200) * 30) / 2, y + Math.floor(h01(i, j, k + 215) * 30) / 2, k % 3 ? shade(base, -0.1) : shade(base, 0.12));
  for (let k = 0; k < 2; k += 1) {
    const ax = x + 3 + Math.floor(h01(i, j, k + 230) * 18) / 2;
    const ay = y + 3 + Math.floor(h01(i, j, k + 235) * 18) / 2;
    for (let s = 0; s < 5; s += 1) dot(g, ax + s * 0.5, ay + Math.abs(s - 2) * 0.5, shade(base, 0.08));
  }
}

/** Верх стіни: волокна вздовж дошок і темні цвяхи. */
export function wallTopHd(g: Ctx, x: number, y: number, i: number, j: number, base: string, vertical: boolean): void {
  for (let k = 0; k < 6; k += 1) {
    const a = 2 + Math.floor(h01(i, j, k + 300) * 24) / 2;
    const b = 1 + Math.floor(h01(i, j, k + 310) * 28) / 2;
    if (vertical) { dot(g, x + a, y + b, shade(base, 0.1)); dot(g, x + a, y + b + 0.5, shade(base, 0.06)); }
    else { dot(g, x + b, y + a, shade(base, 0.1)); dot(g, x + b + 0.5, y + a, shade(base, 0.06)); }
  }
}
