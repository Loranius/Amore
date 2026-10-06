// ============================================================
// Деталі землі у 32×32 (ADR-0239, власник 2026-10-06: «більш
// деталізований піксельний варіант»). Основа клітинки — та сама, що в
// 16×16 (`tiles.ts`); тут — те, що з'являється лише тоді, коли піксель
// малюнка вдвічі дрібніший: окремі травинки, конюшина, камінці з
// відблиском, волокна дощок, цвяшки, візерунок шпалер. Ставиться лише
// `dot` — один піксель малюнка (пів світового).
// ============================================================
import type { SeasonPalette } from './palette';
import { cellHash, dot, mix, shade, type Ctx } from './pixel';

const h01 = (i: number, j: number, k: number) => cellHash(i, j, k + 900) / 4294967296;

/** Трава: тонкі травинки в три тони, конюшина, роса світла. */
export function grassHd(g: Ctx, x: number, y: number, i: number, j: number, P: SeasonPalette, flowers: boolean): void {
  if (P.snow) {
    for (let k = 0; k < 6; k += 1) dot(g, x + h01(i, j, k) * 16, y + h01(i, j, k + 9) * 16, k % 2 ? '#ffffff' : P.grassDark);
    return;
  }
  const dark = shade(P.blade, -0.12);
  for (let k = 0; k < 9; k += 1) {
    const bx = x + 0.5 + Math.floor(h01(i, j, k) * 30) / 2;
    const by = y + 2 + Math.floor(h01(i, j, k + 20) * 26) / 2;
    const tall = 1 + Math.floor(h01(i, j, k + 40) * 3);
    for (let s = 0; s < tall; s += 1) dot(g, bx + (s === tall - 1 && k % 2 ? 0.5 : 0), by - s * 0.5, s === tall - 1 ? P.grassLight : k % 3 ? P.blade : dark);
  }
  // Конюшина: три листочки й темна серединка.
  if (h01(i, j, 60) < 0.18) {
    const cx = x + 3 + Math.floor(h01(i, j, 61) * 18) / 2;
    const cy = y + 3 + Math.floor(h01(i, j, 62) * 18) / 2;
    dot(g, cx, cy, P.grassLight);
    dot(g, cx - 0.5, cy + 0.5, P.grassLight);
    dot(g, cx + 0.5, cy + 0.5, P.grassLight);
    dot(g, cx, cy + 0.5, P.grassDark);
  }
  if (flowers) {
    for (let k = 0; k < 2; k += 1) {
      const fx = x + 2 + Math.floor(h01(i, j, k + 70) * 22) / 2;
      const fy = y + 2 + Math.floor(h01(i, j, k + 80) * 22) / 2;
      const c = P.flowers[Math.floor(h01(i, j, k + 90) * P.flowers.length)]!;
      dot(g, fx, fy + 1, P.blade);
      dot(g, fx, fy + 1.5, P.blade);
      dot(g, fx - 0.5, fy, c);
      dot(g, fx + 0.5, fy, c);
      dot(g, fx, fy - 0.5, c);
      dot(g, fx, fy + 0.5, c);
      dot(g, fx, fy, '#fff2a0');
    }
  }
}

/** Стежка: дрібні камінці зі світлом угорі й тінню внизу, крихти землі. */
export function dirtHd(g: Ctx, x: number, y: number, i: number, j: number, base: string): void {
  for (let k = 0; k < 7; k += 1) {
    const px = x + Math.floor(h01(i, j, k) * 30) / 2;
    const py = y + Math.floor(h01(i, j, k + 10) * 30) / 2;
    dot(g, px, py, k % 3 ? shade(base, -0.16) : shade(base, 0.14));
  }
  for (let k = 0; k < 2; k += 1) {
    const px = x + 2 + Math.floor(h01(i, j, k + 30) * 22) / 2;
    const py = y + 2 + Math.floor(h01(i, j, k + 40) * 22) / 2;
    const stone = mix(base, '#8a8478', 0.6);
    dot(g, px, py, shade(stone, 0.22));
    dot(g, px + 0.5, py, stone);
    dot(g, px, py + 0.5, stone);
    dot(g, px + 0.5, py + 0.5, shade(stone, -0.3));
    dot(g, px + 1, py + 0.5, shade(base, -0.22));
  }
}

/** Бруківка: кожен камінь має освітлений край згори-зліва й тріщинку. */
export function cobbleHd(g: Ctx, x: number, y: number, i: number, j: number, stones: readonly (readonly [number, number, number, number])[]): void {
  stones.forEach(([sx, sy, sw, sh], k) => {
    const hh = h01(i, j, k + 100);
    dot(g, x + sx + 0.5, y + sy + 0.5, 'rgba(255,255,255,0.35)');
    dot(g, x + sx + sw - 1.5, y + sy + sh - 1.5, 'rgba(40,30,20,0.35)');
    if (hh < 0.35) {
      const cx = x + sx + 1 + Math.floor(hh * 2 * (sw - 2)) / 2;
      dot(g, cx, y + sy + 1.5, 'rgba(60,50,40,0.4)');
      dot(g, cx + 0.5, y + sy + 2, 'rgba(60,50,40,0.4)');
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

/** Паркан: волокна дерева, цвяшки на жердинах, скошений верх стовпчика. */
export function fenceHd(g: Ctx, x: number, y: number, wood: string): void {
  for (const pxl of [1, 9]) {
    for (let r = 3; r < 13; r += 2) dot(g, x + pxl + 1.5, y + r, shade(wood, -0.25));
    dot(g, x + pxl + 0.5, y + 2, shade(wood, 0.35));
    dot(g, x + pxl + 1, y + 1.5, shade(wood, 0.2));
    dot(g, x + pxl + 1, y + 5.5, '#5a5a62');
    dot(g, x + pxl + 1, y + 10.5, '#5a5a62');
  }
  for (const ry of [5.5, 10.5]) for (let k = 2; k < 16; k += 5) dot(g, x + k, y + ry, shade(wood, -0.2));
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
