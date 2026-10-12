// ============================================================
// Деталі предметів і меблів у 32×32 (ADR-0239, власник 2026-10-06).
// Поверх того самого малюнка 16×16 (`props.ts`) — пів-пікселі: волокна
// дерева, вишивка рушника й ковдри, розпис печі, жаринки, відблиски на
// банках, вічка картоплі, пасма сіна, річні кільця полін.
// Координати — ті самі, що в `props.ts`: `x, y` — лівий верхній кут клітинки.
// ============================================================
import type { Season } from '../sim/calendar';
import type { Prop } from '../world/types';
import { PALETTES } from './palette';
import { cellHash, dot, mix, rect, shade, type Ctx } from './pixel';

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
    // ── Село Жилинці (власник 2026-10-12: «перейдемо до Жилинців аналогічно»).
    case 'sandbox': {
      // Пісочниця: дошки рамки з волокнами, світла верхня кромка й тінь;
      // пісок зернистий, тінь рамки на піску, відерце з дужкою, пасочка.
      const wood = '#9a6a3a';
      grain(g, x + 1, y + 0.5, 30, 1, wood, seed);
      grain(g, x + 1, y + 22.5, 30, 1, wood, seed + 1);
      grain(g, x + 0.5, y + 2, 1, 20, wood, seed + 2, 'v');
      grain(g, x + 30.5, y + 2, 1, 20, wood, seed + 3, 'v');
      rect(g, x, y, 32, 0.5, shade(wood, 0.25));
      rect(g, x, y + 23.5, 32, 0.5, shade(wood, -0.3));
      if (snow) break;
      for (let k = 0; k < 40; k += 1) {
        const r = h(k, seed, 40);
        dot(g, x + 2.5 + (r % 54) / 2, y + 2.5 + ((r >>> 6) % 38) / 2, k % 3 ? '#d8c088' : '#f8e8b8');
      }
      rect(g, x + 2, y + 2, 28, 0.5, '#c8b078');
      rect(g, x + 2, y + 2, 0.5, 20, '#c8b078');
      dot(g, x + 8.5, y + 7, '#5a5a64');
      rect(g, x + 9, y + 6.5, 2, 0.5, '#5a5a64');
      dot(g, x + 11, y + 7, '#5a5a64');
      rect(g, x + 8, y + 8, 4, 0.5, '#ff9a8a');
      rect(g, x + 8, y + 8.5, 0.5, 2.5, '#ff7a6a');
      rect(g, x + 11.5, y + 8.5, 0.5, 2.5, '#a82a20');
      dot(g, x + 18.5, y + 12, '#f0d088');
      dot(g, x + 19, y + 11.5, '#f0d088');
      rect(g, x + 20.5, y + 15.5, 2, 0.5, '#b8943a');
      rect(g, x + 24, y + 17, 3, 2, '#d9b45a');
      rect(g, x + 24, y + 17, 3, 0.5, '#ecd08a');
      rect(g, x + 26.5, y + 17, 0.5, 2, '#b8943a');
      break;
    }
    case 'swing': {
      // Гойдалка: стовпи з відблиском і тінню, ланцюги ланками, дошки сидінь.
      const ang = Math.sin(t * 2) * 3;
      for (const px0 of [x, x + 24]) {
        rect(g, px0, y - 12, 0.5, 28, '#e8706a');
        rect(g, px0 + 1.5, y - 12, 0.5, 28, '#962f36');
      }
      rect(g, x - 1, y - 13, 28, 0.5, '#f6d878');
      rect(g, x - 1, y - 11.5, 28, 0.5, '#b8862a');
      for (const sx of [6, 16]) {
        for (const cx of [x + sx + ang, x + sx + 4 + ang]) for (let k = 0; k < 18; k += 1.5) dot(g, cx, y - 11 + k, '#a0a0aa');
        grain(g, x + sx - 1 + ang, y + 7, 7, 2, '#8a5a34', seed + sx);
        rect(g, x + sx - 1 + ang, y + 7, 7, 0.5, '#a8784a');
      }
      break;
    }
    case 'slide': {
      // Гірка: блиск уздовж жолоба й тінь його нижнього краю, стовпи драбини з відблиском.
      for (const px0 of [x + 2, x + 8]) {
        rect(g, px0, y - 10, 0.5, 24, '#8ac4f0');
        rect(g, px0 + 1.5, y - 10, 0.5, 24, '#3a7ac0');
      }
      for (let k = 0; k < 14; k += 1) {
        dot(g, x + 11 + k, y - 10 + k, '#fff0a8');
        dot(g, x + 11.5 + k, y - 10 + k, '#fff0a8');
        dot(g, x + 13.5 + k, y - 8.5 + k, '#c89a2a');
      }
      break;
    }
    case 'busStop': {
      // Зупинка: відблиски на склі навскіс, розклад, тінь під дахом, дошки лави.
      for (const ax of [x + 5, x + 13]) for (let k = 0; k < 6; k += 1) dot(g, ax + k * 0.5, y - 1 - k, 'rgba(255,255,255,0.55)');
      rect(g, x + 19.5, y - 5.5, 3.5, 4.5, '#f4f4f7');
      for (let k = 0; k < 4; k += 1) rect(g, x + 20, y - 5 + k, k === 3 ? 1.5 : 2.5, 0.5, '#9a9aa4');
      rect(g, x - 1, y - 7.5, 30, 0.5, '#2a52a8');
      rect(g, x + 1, y - 8, 0.5, 23, '#8a92a0');
      rect(g, x + 25, y - 8, 0.5, 23, '#8a92a0');
      grain(g, x + 4, y + 7, 20, 3, '#8a6a4a', seed);
      rect(g, x + 4, y + 7, 20, 0.5, '#a8886a');
      rect(g, x + 28, y - 16, 7, 0.5, '#fbe08a');
      break;
    }
    case 'board': {
      // Дошка оголошень: рядки тексту, кнопки, загнутий кутик, волокна рамки.
      grain(g, x, y - 10, 20, 1, '#9a6a3a', seed);
      ([[x + 2, y - 8, '#e8402e'], [x + 11, y - 8, '#3a6fd8'], [x + 2, y - 2, '#3a9a5a'], [x + 11, y - 2, '#e8402e']] as const).forEach(([nx, ny, pin], k) => {
        for (let r = 1.5; r < 4.5; r += 1) rect(g, nx + 1, ny + r, r > 3 ? 2.5 : 4.5 - (k % 2), 0.5, '#9a9aa4');
        dot(g, nx + 3.5, ny + 0.5, pin);
        dot(g, nx + 6.5, ny + 4.5, 'rgba(60,40,20,0.3)');
      });
      break;
    }
    case 'goal': {
      // Ворота: сітка клітинками, тінь на стовпах.
      for (let k = 1; k < 22; k += 3) rect(g, x + 2, y - 8 + k, 36, 0.5, 'rgba(255,255,255,0.3)');
      rect(g, x + 1.5, y - 8, 0.5, 24, '#c8c8d0');
      rect(g, x + 39.5, y - 8, 0.5, 24, '#c8c8d0');
      rect(g, x + 2, y - 8.5, 36, 0.5, '#c8c8d0');
      break;
    }
    case 'mailbox':
      rect(g, x + 4, y + 0.5, 0.5, 6.5, '#7aa8f8');
      rect(g, x + 11.5, y + 0.5, 0.5, 6.5, '#2a4a9a');
      rect(g, x + 6, y + 4, 4, 0.5, '#7aa8f8');
      rect(g, x + 7, y + 6, 0.5, 9, '#8a8a94');
      break;
    case 'rock': {
      // Камінь: грані (світла верхня, темна праворуч унизу), тріщина, мох.
      rect(g, x + 3, y + 10.5, 4, 0.5, '#9a9488');
      rect(g, x + 9, y + 13, 4, 0.5, '#6e685e');
      rect(g, x + 12.5, y + 10, 0.5, 3, '#6e685e');
      for (let k = 0; k < 5; k += 1) dot(g, x + 8 + k * 0.5, y + 7.5 + k * 0.5 + (k % 2) * 0.5, '#5e5850');
      if (snow) break;
      dot(g, x + 3, y + 12, '#6f8a3a');
      dot(g, x + 3.5, y + 12.5, '#8aa44a');
      dot(g, x + 4, y + 12, '#6f8a3a');
      break;
    }
    case 'bush': {
      // Кущ: листя парами (лист і його тінь), як у кроні дерев; ягоди круглі.
      if (snow) {
        for (let k = 0; k < 6; k += 1) { const r = h(k, seed, 51); dot(g, x + 3 + (r % 20) / 2, y + 6 + ((r >>> 6) % 8) / 2, '#e2eaf4'); }
        break;
      }
      const P = PALETTES[season];
      for (let k = 0; k < 42; k += 1) {
        const r = h(k, seed, 50);
        const ang = ((r >>> 4) % 360) * (Math.PI / 180);
        const rr = (((r >>> 12) % 100) / 100) * 6.2;
        const lx = Math.round((x + 8 + Math.cos(ang) * rr) * 2) / 2;
        const ly = Math.round((y + 9 + Math.sin(ang) * rr * 0.85) * 2) / 2;
        const lit = Math.cos(ang) < 0 && Math.sin(ang) < 0;
        dot(g, lx, ly, lit ? P.leafLight : (r >>> 22) % 3 === 0 ? P.leafDark : P.leaf);
        dot(g, lx + 0.5, ly + 0.5, shade(P.leafDark, -0.12));
      }
      if (season === 'summer') {
        for (const [bx, by] of [[x + 4, y + 10], [x + 12, y + 11]] as const) {
          dot(g, bx + 0.5, by, '#e8402e');
          dot(g, bx, by + 0.5, '#e8402e');
          dot(g, bx + 0.5, by + 0.5, '#a82a20');
          dot(g, bx, by, '#ff9a8a');
        }
      }
      break;
    }
    case 'duck': {
      // Качка: крило рискою, біле кільце на шиї, око, хвостик, кола на воді.
      const base = cellHash(Math.round(p.x * 5), Math.round(p.y * 5), 1);
      const swim = Math.sin(t * 0.6 + base) * 14;
      const cx = x + 8 + Math.round(swim);
      const f = Math.cos(t * 0.6 + base) > 0 ? 1 : -1;
      rect(g, cx - 2.5, y + 9.5, 3, 0.5, '#d8d0c0');
      dot(g, cx - 4.5 * f, y + 9, '#e8e0d0');
      dot(g, cx + 2 * f, y + 8.5, '#ffffff');
      dot(g, cx + 3.5 * f, y + 6.5, '#1b1b22');
      dot(g, cx + 2.5 * f, y + 6, '#5aaa6a');
      if (snow) break;
      const ring = (t * 0.8 + base) % 2;
      rect(g, cx - 5 - ring, y + 12.5, 11 + ring * 2, 0.5, `rgba(255,255,255,${(0.35 * (2 - ring) / 2).toFixed(2)})`);
      break;
    }
    case 'flowerBed': {
      // Клумба: земля грудочками (під снігом — лише нижче шапки), облямівка
      // з камінців згори й знизу, листя біля стебел, серединки квітів.
      for (let k = 0; k < 12; k += 1) {
        const r = h(k, seed, 30);
        const cy = y + 4.5 + ((r >>> 6) % 18) / 2;
        if (snow && cy < y + 8.5) continue;
        dot(g, x + 0.5 + (r % 30) / 2, cy, k % 2 ? '#94704a' : '#5e4228');
      }
      for (const ey of [y + 3.5, y + 13.5]) {
        for (let ex = x + (ey > y + 8 ? 0 : 1); ex < x + 15; ex += 2.5) {
          rect(g, ex, ey, 1.5, 1, '#a8a090');
          dot(g, ex, ey, snow ? '#ffffff' : '#d0c8b8');
          dot(g, ex + 1, ey + 0.5, '#6e685e');
        }
      }
      if (snow) break;
      const base = cellHash(Math.round(p.x * 5), Math.round(p.y * 5), 1);
      for (let k = 0; k < 6; k += 1) {
        const fx = x + 2 + ((k * 5 + base) % 12);
        const fy = y + 3 + ((k * 3) % 5);
        dot(g, fx - 0.5, fy + 2, '#5aa04a');
        dot(g, fx + 1, fy + 2.5, '#4a8a3a');
        dot(g, fx - 0.5, fy - 0.5, 'rgba(255,255,255,0.45)');
        dot(g, fx, fy, '#fff2a0');
      }
      break;
    }
    case 'lava':
      grain(g, x, y + 5.5, 32, 2.5, '#a8784a', seed);
      if (p.variant === 1) {
        for (const bx of [x + 3, x + 12]) {
          dot(g, bx + 1.5, y - 1, '#ffffff');
          dot(g, bx + 1.5, y - 0.5, '#ffffff');
          dot(g, bx + 5, y - 1.5, '#cfe8f7');
          dot(g, bx + 6.5, y + 2.5, '#3a6fd8');
          dot(g, bx + 2, y + 3, '#c9d2dc');
        }
      }
      break;
    case 'chest':
      for (const fx of [x + 8, x + 16]) {
        dot(g, fx + 0.5, y + 8.5, '#ff9aa8');
        dot(g, fx - 2.5, y + 10.5, '#b6dc8a');
        dot(g, fx + 2.5, y + 10.5, '#b6dc8a');
      }
      for (const bx of [x + 3, x + 19]) for (const ry of [2, 6.5, 11]) dot(g, bx + 0.5, y + ry, '#a8a094');
      dot(g, x + 11.5, y + 5.5, '#fff1a8');
      grain(g, x, y + 1.5, 24, 2, '#2f6a5a', seed + 2);
      break;
    case 'coatRack':
      for (let r = 7; r < 16; r += 3) dot(g, x + 6.5, y + r, '#c9b48e');
      dot(g, x + 11, y + 8, '#ff8a8a');
      dot(g, x + 13.5, y + 9, '#f6d55c');
      dot(g, x + 13.5, y + 11.5, '#f6d55c');
      for (let k = 0; k < 7; k += 2) dot(g, x + 17.5 + k * 0.5, y + 4.5, '#e8c886');
      break;
    case 'shoes':
      dot(g, x + 2.5, y + 4, '#7a9a6a');
      dot(g, x + 6.5, y + 4, '#7a9a6a');
      dot(g, x + 13, y + 9.5, '#f8f4ec');
      dot(g, x + 17, y + 9.5, '#f8f4ec');
      break;
    case 'ball':
      dot(g, x + 9, y + 9.5, '#ffffff');
      dot(g, x + 9.5, y + 10, '#ffffff');
      dot(g, x + 8.5, y + 11.5, '#2b2b33');
      break;
    case 'laundry': {
      if (snow) break;
      // Складки простирадла, ґудзики сорочки, вишивка рушника.
      const sway = (n: number) => Math.round(Math.sin(t * 2.2 + n * 1.3) * 1.2);
      for (const r of [-12, -8, -4]) dot(g, x + 9.5 + sway(0), y + r, '#dcd8cc');
      for (const r of [-12, -9.5, -7]) dot(g, x + 29 + sway(1), y + r, '#f4f4f7');
      for (let k = 0; k < 6; k += 2) dot(g, x + 39 + k + sway(2), y - 4.5, '#e05a4a');
      dot(g, x + 53.5 + sway(3), y - 9, '#ffd1e0');
      break;
    }
    case 'chopBlock':
      for (const [rx, ry] of [[5, 5.5], [11, 6.5], [8, 7]] as const) dot(g, x + rx, y + ry, '#a8784a');
      dot(g, x + 4.5, y + 3, '#eef2f6');
      grain(g, x + 2, y + 7, 12, 6, '#7a5230', seed, 'v');
      break;
    case 'wheelbarrow':
      dot(g, x + 3, y + 4, '#a8c0cc');
      dot(g, x + 14.5, y + 4, '#a8c0cc');
      dot(g, x + 1.5, y + 10.5, '#5a5a62');
      dot(g, x + 2.5, y + 11.5, '#5a5a62');
      break;
    case 'dogHouse':
      grain(g, x + 1, y + 4, 18, 9, '#a8784a', seed);
      for (let k = 0; k < 10; k += 2) dot(g, x + 2 + k * 1.6, y + 1.5 + (k % 4 === 0 ? 0 : 1), '#c86a4a');
      dot(g, x + 8.5, y + 8.5, '#3a2a24');
      break;
    case 'bowl':
      dot(g, x + 7.5, y + 11, '#d8b884');
      dot(g, x + 9, y + 11.5, '#c99a62');
      break;
    case 'jugs':
      for (const jx of [2, 18, 34]) { dot(g, x + jx - 0.5, y + 4.5, '#ffd8b0'); dot(g, x + jx + 1.5, y + 9, '#6a2a1a'); }
      break;
    case 'bucket':
      dot(g, x + 7, y + 8, snow ? '#ffffff' : '#a8d8f4');
      dot(g, x + 6, y + 10, '#b8c2cc');
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
