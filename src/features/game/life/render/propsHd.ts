// ============================================================
// Деталі предметів і меблів у 32×32 (ADR-0239, власник 2026-10-06).
// Поверх того самого малюнка 16×16 (`props.ts`) — пів-пікселі: волокна
// дерева, вишивка рушника й ковдри, розпис печі, жаринки, відблиски на
// банках, вічка картоплі, пасма сіна, річні кільця полін.
// Координати — ті самі, що в `props.ts`: `x, y` — лівий верхній кут клітинки.
// ============================================================
import type { Season } from '../sim/calendar';
import type { Prop } from '../world/types';
import { cellHash, dot, mix, shade, type Ctx } from './pixel';

const h = (a: number, b: number, k: number) => cellHash(a, b, k + 700);

/** Волокна дерева: короткі рисочки пів-пікселя вздовж дошки. */
function grain(g: Ctx, x: number, y: number, w: number, hgt: number, base: string, seed: number, along: 'h' | 'v' = 'h'): void {
  const n = Math.max(2, Math.floor((w * hgt) / 10));
  for (let k = 0; k < n; k += 1) {
    const r = h(k, seed, 1);
    const gx = x + (r % Math.max(1, (w - 1) * 2)) / 2;
    const gy = y + ((r >>> 10) % Math.max(1, (hgt - 0.5) * 2)) / 2;
    const c = shade(base, -0.14);
    dot(g, gx, gy, c);
    if (along === 'h') dot(g, gx + 0.5, gy, c);
    else dot(g, gx, gy + 0.5, c);
  }
}

/** Хрестики вишивки рядком. */
function stitches(g: Ctx, x: number, y: number, n: number, step: number, color: string): void {
  for (let k = 0; k < n; k += 1) {
    const cx = x + k * step;
    dot(g, cx, y, color);
    dot(g, cx + 0.5, y + 0.5, color);
    dot(g, cx + 1, y, color);
    dot(g, cx, y + 1, color);
    dot(g, cx + 1, y + 1, color);
  }
}

export function propHd(g: Ctx, p: Prop, x: number, y: number, t: number, season: Season): void {
  const seed = Math.round(p.x * 7 + p.y * 13);
  const snow = season === 'winter';
  switch (p.type) {
    case 'bench':
      grain(g, x + 1, y + 4, 16, 2, '#9a6a3a', seed);
      grain(g, x + 1, y + 8, 16, 2, '#9a6a3a', seed + 1);
      break;
    case 'well':
      for (let k = 0; k < 16; k += 4) dot(g, x + 3 + k, y + 7, '#c8c2b4');
      for (let r = 0; r < 12; r += 1) dot(g, x + 9.5, y - 5 + r, r % 2 ? '#a88a6a' : '#6a5a4a');
      dot(g, x + 7, y + 7.5, '#9fd0ec');
      dot(g, x + 12.5, y + 7.5, '#9fd0ec');
      if (!snow) for (let k = 1; k < 19; k += 2) dot(g, x + k, y - 8.5 + (k % 4 === 1 ? 0.5 : 0), '#e07a5c');
      break;
    case 'haystack':
      if (snow) break;
      for (let k = 0; k < 40; k += 1) {
        const r = h(k, seed, 3);
        const sx = x + 2 + (r % 32) / 2;
        const sy = y + 1 + ((r >>> 6) % 26) / 2;
        dot(g, sx, sy, k % 3 ? '#f2d886' : '#b8943a');
        dot(g, sx + 0.5, sy + 0.5, '#c9a24a');
      }
      break;
    case 'woodpile':
      for (let r = 0; r < 4; r += 1) {
        for (let k = 0; k < 7; k += 1) {
          const cx = x + 2 + k * 4 + (r % 2) * 2;
          if (cx > x + 25) continue;
          const cy = y + 1 + r * 3;
          dot(g, cx - 1, cy - 1, '#e6c08a');
          dot(g, cx + 0.5, cy, '#8a5a30');
          dot(g, cx, cy + 0.5, '#9a6a3a');
        }
      }
      break;
    case 'workbench':
      grain(g, x, y + 3, 22, 4, '#a8784a', seed);
      dot(g, x + 4, y + 1.5, '#9aa0a8');
      dot(g, x + 16, y - 0.5, '#e8705a');
      break;
    case 'planks':
      for (let k = 0; k < 4; k += 1) grain(g, x, y + 4 + k * 2, 26, 2, k % 2 ? '#c99a62' : '#b0844e', seed + k);
      break;
    case 'cellar':
      grain(g, x + 4, y + 6, 12, 8, '#7a5230', seed, 'v');
      dot(g, x + 10, y + 10.5, '#c8ccd4');
      break;
    case 'bed': {
      const c = p.tint ?? '#e98fb0';
      // Мереживо на подушці й вишита смуга на ковдрі.
      for (let k = 1.5; k < 15; k += 1) dot(g, x + k, y + 6.5, k % 2 ? '#ffffff' : '#e8e0d4');
      stitches(g, x + 2, y + 9.5, 6, 2, shade(c, -0.35));
      for (let k = 0; k < 14; k += 1) dot(g, x + 1 + k, y + 25.5, shade(c, -0.2));
      grain(g, x, y + 26, 16, 2, '#6e4a2a', seed);
      break;
    }
    case 'wardrobe':
      grain(g, x, y - 10, 16, 22, '#a8784a', seed, 'v');
      dot(g, x + 6, y + 1.5, '#3a2a20');
      dot(g, x + 9.5, y + 1.5, '#3a2a20');
      break;
    case 'table': case 'desk':
      grain(g, x, y + 3, 24, 6, p.type === 'table' ? (p.tint ?? '#c49a6c') : '#a8784a', seed);
      break;
    case 'chair':
      grain(g, x + 3, y + 6.5, 10, 2, '#a8784a', seed);
      break;
    case 'stove': {
      // Розпис печі: квіточки з п'ятьох пелюсток і листочки.
      for (const [dx, dy] of [[3, -8], [11, -6], [6, -3]] as const) {
        for (const [ox, oy] of [[-0.5, 0], [0.5, 0], [0, -0.5], [0, 0.5]] as const) dot(g, x + dx + ox, y + dy + oy, '#3f7fc8');
        dot(g, x + dx, y + dy, '#f6d55c');
        dot(g, x + dx + 1, y + dy + 1, '#5a9a4a');
        dot(g, x + dx - 1, y + dy + 1, '#5a9a4a');
      }
      for (let k = 0; k < 4; k += 1) dot(g, x + 5 + k * 1.5, y + 7.5 - (Math.floor(t * 8 + k) % 2) * 0.5, '#ffd27a');
      break;
    }
    case 'clayOven': {
      // Тріщинки в побілці, жаринки, що мерехтять, розпис дрібніше.
      for (let k = 0; k < 6; k += 1) {
        const r = h(k, seed, 9);
        const cx = x + 4 + (r % 100) / 2;
        const cy = y + 18 + ((r >>> 8) % 50) / 2;
        for (let s = 0; s < 3; s += 1) dot(g, cx + s * 0.5, cy + (s % 2) * 0.5, '#cfc5b2');
      }
      for (let k = 0; k < 8; k += 1) {
        const on = (Math.floor(t * 7) + k) % 3 === 0;
        dot(g, x + 22 + k * 2, y + 40 + (k % 2) * 0.5, on ? '#ffe08a' : '#f08a3a');
      }
      for (const [fx, fy] of [[6, 22], [9, 34], [50, 22], [6, 42]] as const) {
        dot(g, x + fx + 0.5, y + fy + 1.5, '#ffffff');
        dot(g, x + fx - 1.5, y + fy + 2.5, '#5a9a4a');
        dot(g, x + fx + 2, y + fy + 2.5, '#5a9a4a');
      }
      for (let k = 2; k < 54; k += 2) dot(g, x + k, y + 15.5, k % 4 ? '#2b2b33' : '#e05a5a');
      dot(g, x + 46.5, y + 38, '#c88a5a');
      break;
    }
    case 'window':
      dot(g, x + 3.5, y + 2.5, '#ffffff');
      dot(g, x + 4, y + 3, '#ecf8fe');
      for (let r = 2.5; r < 12; r += 1.5) { dot(g, x + 3, y + r, '#d77898'); dot(g, x + 12.5, y + r, '#d77898'); }
      break;
    case 'rushnyk':
      // Вишивка хрестиком: червоні ромбики з чорним, китиці внизу.
      for (const sx of [2, 11]) {
        for (let k = 0; k < 4; k += 1) {
          dot(g, x + sx + 1, y + 5.5 + k * 2, '#b8323a');
          dot(g, x + sx + 1.5, y + 6 + k * 2, '#2b2b33');
          dot(g, x + sx + 2, y + 5.5 + k * 2, '#b8323a');
        }
        for (let k = 0; k < 3; k += 1) dot(g, x + sx + k, y + 14, '#b8323a');
      }
      break;
    case 'rug': {
      const c = p.tint ?? '#e98fb0';
      for (let k = 0; k < 24; k += 1) {
        const a = (k / 24) * Math.PI * 2;
        dot(g, x + 16 + Math.cos(a) * 11.5, y + 8 + Math.sin(a) * 4.8, shade(c, 0.35));
      }
      break;
    }
    case 'plant': case 'pot':
      dot(g, x + 7.5, y + 3, mix(p.tint ?? '#3f8a43', '#ffffff', 0.35));
      dot(g, x + 5, y + 5.5, mix(p.tint ?? '#3f8a43', '#ffffff', 0.25));
      dot(g, x + 5, y + 10, '#f2a080');
      break;
    case 'shelf':
      for (let r = 0; r < 3; r += 1) for (let k = 0; k < 5; k += 1) dot(g, x + 2.5 + k * 3, y - 7.5 + r * 8, 'rgba(255,255,255,0.45)');
      break;
    case 'clock':
      for (let k = 0; k < 12; k += 3) dot(g, x + 8 + Math.round(Math.cos((k / 12) * Math.PI * 2) * 3 * 2) / 2, y + 6 + Math.round(Math.sin((k / 12) * Math.PI * 2) * 3 * 2) / 2, '#5a3a24');
      break;
    case 'crates':
      for (let k = 0; k < 6; k += 1) {
        dot(g, x + 1.5 + (k % 3) * 4, y + 2.5 + Math.floor(k / 3) * 2, '#ffd0c0');
        dot(g, x + 16.5 + (k % 3) * 4, y + 2.5 + Math.floor(k / 3) * 2, '#f0d8a8');
      }
      grain(g, x, y + 4, 13, 11, '#a8784a', seed, 'v');
      grain(g, x + 15, y + 4, 13, 11, '#a8784a', seed + 1, 'v');
      break;
    case 'jarShelf': {
      // Відблиск на кожній банці й мотузочка під кришкою.
      const top = y - 34;
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const sy = top + 14 + shelf * 16;
        for (let k = 0; k < 11; k += 1) {
          const r = cellHash(k, shelf, 47);
          if (r % 9 === 0) continue;
          const jx = x + 6 + k * 12 + (r % 3);
          const jh = 7 + ((r >>> 3) % 4);
          dot(g, jx + 1.5, sy - jh + 1.5, '#ffffff');
          dot(g, jx + 1.5, sy - jh + 2, 'rgba(255,255,255,0.6)');
          for (let q = 0; q < 8; q += 1) dot(g, jx + q, sy - jh - 0.5, '#9a7a5a');
        }
        grain(g, x, sy, 144, 3, '#8a5a34', shelf);
      }
      break;
    }
    case 'zasik': {
      const H = 146;
      for (let k = 0; k < 160; k += 1) {
        const r = h(k, p.variant ?? 0, 11);
        dot(g, x + 4 + (r % 80) / 2, y + 4 + ((r >>> 8) % ((H - 8) * 2)) / 2, p.variant === 1 ? (k % 3 ? '#5a1a30' : '#f0a060') : k % 3 ? '#6e5030' : '#e0c088');
      }
      break;
    }
    case 'partition':
      grain(g, x + 1, y - 10, 6, 154, '#7a5232', seed, 'v');
      break;
    case 'cellarStairs':
      for (let k = 0; k < 7; k += 1) for (let q = 0; q < 48; q += 3) dot(g, x + q, y + k * 6 + 0.5, shade('#6a4a30', k * 0.07 + 0.25));
      break;
    case 'door':
      grain(g, x + 3, y - 7, 10, 20, '#a8784a', seed, 'v');
      break;
    default:
      break;
  }
}
