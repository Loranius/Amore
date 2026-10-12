// ============================================================
// Деталі будинків у 32×32 (ADR-0239, власник 2026-10-06). Основа — та
// сама, що в 16×16 (`buildings.ts`), а тут — пів-пікселі, яких у 16×16
// немає місця: окремі стебла соломи, заокруглений край кожної черепиці,
// відблиск на бляшаних ребрах, фактура штукатурки й дошок, складки фіранок,
// волокна дверей, пелюстки квітів.
// ============================================================
import type { Season } from '../sim/calendar';
import { cellHash, dot, hexToRgb, mix, rect, shade, type Ctx } from './pixel';

type RoofKind = 'thatch' | 'tile' | 'flat' | 'metal' | 'none';

const m = (v: number, n: number) => ((v % n) + n) % n;

/**
 * Тони окремих дощок, черепиць і листів бляхи відносно основного кольору.
 * Палітра будівлі зливає кольори ближчі за `NEAR_DUPLICATE` (`pixel.ts`),
 * тож тон мусить відходити далі — інакше різниця мовчки зникає.
 */
export const PLANK_TONES = [-0.1, 0.09] as const;
export const SHINGLE_TONES = [-0.12, 0.1] as const;
export const PANEL_TONES = [-0.1, 0.08] as const;

/** Один ряд даху: `y` — рядок у спрайті, `ry` — у світі (шви тягнуться через стики крил). */
export function roofRowHd(g: Ctx, kind: RoofKind, color: string, x0: number, x1: number, y: number, ry: number, atX: number, cs: number): void {
  if (kind === 'thatch') {
    // Шари стріхи по 6 рядків (як у `buildings.ts`): під межею шару —
    // тінь від кінчиків, над нею — світлі кінчики, посередині — окремі
    // стебла пасмами вниз.
    const light = mix(color, '#f6e6a8', 0.45);
    const dark = shade(color, -0.24);
    const course = m(ry, 6);
    for (let x = x0; x < x1; x += 0.5) {
      const hh = cellHash(Math.round((atX + x) * 2), Math.floor(ry / 6), cs) % 9;
      if (course === 1 && (hh === 0 || hh === 4)) dot(g, x, y, dark);
      else if (course === 5 && (hh === 2 || hh === 6)) dot(g, x, y + 0.5, light);
      else if ((course === 2 || course === 3) && hh === 7) { dot(g, x, y, light); dot(g, x, y + 0.5, shade(light, -0.1)); }
      else if (course === 4 && hh === 1) dot(g, x, y + 0.5, dark);
    }
  } else if (kind === 'tile') {
    const band = Math.floor(ry / 4);
    const off = m(band, 2) === 0 ? 0 : 3;
    const row = m(ry, 4);
    if (row !== 3) {
      // Кожна черепиця свого тону (тони далекі: палітра будівлі зливає
      // близькі), на старих сірих дахах — мох на нижньому краї черепиці.
      const [cr, cg, cb] = hexToRgb(color);
      const grey = Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 26;
      for (let x = Math.ceil(x0); x < x1; x += 1) {
        const u = atX + x - off;
        const t = m(u, 6);
        if (t === 0) continue;
        const cell = Math.floor(u / 6);
        const hv = cellHash(cell, band, cs + 17) % 9;
        if (hv === 0) rect(g, x, y, 1, 1, shade(color, SHINGLE_TONES[0]));
        else if (hv === 1) rect(g, x, y, 1, 1, shade(color, SHINGLE_TONES[1]));
        else if (hv === 2 && row === 2 && (t === 2 || t === 3) && (grey || cellHash(cell, band, cs + 19) % 3 === 0)) {
          dot(g, x, y + 0.5, '#7f8a44');
          dot(g, x + 0.5, y + 0.5, '#9aa452');
          if (t === 2) dot(g, x + 0.5, y, '#9aa452');
        }
      }
    }
    for (let x = Math.ceil(x0); x < x1; x += 1) {
      const t = m(atX + x - off, 6);
      // Відблиск на верхньому лівому краї луски й заокруглення знизу.
      if (row === 0 && t === 1) dot(g, x + 0.5, y + 0.5, shade(color, 0.32));
      if (row === 2 && t === 0) dot(g, x + 0.5, y + 0.5, shade(color, -0.32));
      if (row === 2 && t === 5) dot(g, x, y + 0.5, shade(color, -0.32));
      if (row === 1 && t === 3) dot(g, x, y, shade(color, 0.08));
    }
  } else if (kind === 'metal') {
    // Листи покрівлі: кожен свого тону, хвиля (світлий гребінь біля шва,
    // темна ложбинка посередині), на деяких — руді патьоки іржі.
    const row = m(ry, 4);
    for (let x = Math.ceil(x0); x < x1; x += 1) {
      const u = atX + x - 2;
      const t = m(u, 5);
      if (t === 0 || row === 3) continue;
      const panel = Math.floor(u / 5);
      const hv = cellHash(panel, 0, cs + 23) % 6;
      if (hv === 0) rect(g, x, y, 1, 1, shade(color, PANEL_TONES[0]));
      else if (hv === 1) rect(g, x, y, 1, 1, shade(color, PANEL_TONES[1]));
      if (t === 3) dot(g, x + 0.5, y, shade(color, -0.14));
      if (hv === 2 && t === 2 && cellHash(panel, Math.floor(ry / 4), cs + 29) % 3 === 0) {
        dot(g, x, y, '#a0603a');
        dot(g, x, y + 0.5, '#8a4a2e');
      }
    }
    for (let x = Math.ceil(x0); x < x1; x += 1) if (m(atX + x - 2, 5) === 0 && row !== 3) dot(g, x + 1, y, shade(color, 0.22));
  }
}

/** Фактура стіни: штукатурка з дрібними плямками й волосяними тріщинками, дошки з волокнами й цвяхами. */
export function wallHd(g: Ctx, W: number, top: number, bottom: number, material: string, color: string, seed: number): void {
  const H = bottom - top;
  if (material === 'plaster') {
    for (let k = 0; k < (W * H) / 14; k += 1) {
      const h = cellHash(k, seed, 77);
      const x = 3 + (h % ((W - 6) * 2)) / 2;
      const y = top + ((h >>> 9) % (H * 2)) / 2;
      dot(g, x, y, (h >>> 20) % 3 === 0 ? shade(color, 0.06) : shade(color, -0.05));
    }
    for (let k = 0; k < Math.floor(W / 30); k += 1) {
      const h = cellHash(k, seed, 78);
      const x = 6 + (h % Math.max(1, W - 14));
      const y = top + 6 + ((h >>> 8) % Math.max(1, H - 14));
      for (let s = 0; s < 4; s += 1) dot(g, x + s * 0.5, y + s * 0.5 + (s % 2) * 0.5, shade(color, -0.12));
    }
  } else if (material === 'wood') {
    // Дошки різної довжини: стики в різних місцях кожного ряду, кожна дошка
    // свого тону (тони далекі — палітра будівлі зливає близькі), волокна
    // довгими рисками, сучки, по два цвяхи біля стику; відблиск верхнього
    // краю дошки — тонкий, на пів пікселя.
    for (let r = 0; r + 3 < H; r += 4) {
      const y0 = top + r;
      const joints: number[] = [];
      for (let jx = 6 + (cellHash(r, seed, 41) % 16); jx < W - 8; jx += 12 + (cellHash(jx, r, seed + 42) % 20)) joints.push(jx);
      const edges = [3, ...joints, W - 3];
      for (let k = 0; k + 1 < edges.length; k += 1) {
        const a = edges[k]!;
        const b = edges[k + 1]!;
        const hh = cellHash(a, r, seed + 43);
        const tone = hh % 3 === 0 ? PLANK_TONES[0] : hh % 3 === 1 ? PLANK_TONES[1] : 0;
        const body = tone ? shade(color, tone) : color;
        rect(g, a, y0 + 0.5, b - a, 2.5, body);
        const n = Math.max(1, Math.round((b - a) / 6));
        for (let q = 0; q < n; q += 1) {
          const v = cellHash(q, a * 7 + r, seed + 44);
          const len = 2 + (v % 5);
          if (b - a - 1 <= len) continue;
          const gx = a + 0.5 + ((v >>> 4) % Math.floor((b - a - len - 0.5) * 2)) / 2;
          const gy = y0 + 1 + ((v >>> 12) % 4) / 2;
          rect(g, gx, gy, len, 0.5, shade(body, -0.14));
          if (v % 3 === 0) dot(g, gx + len, gy + 0.5, shade(body, -0.14));
        }
        if (hh % 5 === 0 && b - a > 8) {
          const kx = a + 3 + ((hh >>> 8) % Math.max(1, b - a - 6));
          dot(g, kx, y0 + 1.5, shade(body, -0.4));
          dot(g, kx + 0.5, y0 + 1.5, shade(body, -0.28));
          dot(g, kx, y0 + 1, shade(body, -0.16));
          dot(g, kx + 0.5, y0 + 2, shade(body, -0.16));
        }
      }
      for (const jx of joints) {
        rect(g, jx, y0 + 0.5, 0.5, 2.5, shade(color, -0.32));
        dot(g, jx + 0.5, y0 + 0.5, shade(color, 0.14));
        // Цвях — біля кожного другого стику: на кожному цятки сипались шумом.
        const v = cellHash(jx, r, seed + 46);
        if (v % 2 === 0) dot(g, jx + (v % 4 === 0 ? -1 : 1), y0 + 1.5, '#4a4a52');
      }
    }
    // Низ стіни — від дощу й бризок: подекуди мох і бруд над цоколем.
    for (let x = 4; x < W - 4; x += 1) {
      const v = cellHash(x, seed, 45);
      if (v % 3 === 0) dot(g, x + (v % 2) * 0.5, bottom - 3.5 - ((v >>> 3) % 2) * 0.5, mix(color, '#56603a', 0.45));
    }
  } else if (material === 'brick') {
    for (let r = 0; r < H; r += 3) dot(g, 4 + (cellHash(r, seed, 5) % (W - 8)), top + r + 0.5, shade(color, 0.18));
  }
}

/**
 * Вікно: подвійний відблиск на склі, складка фіранки суцільною лінією,
 * світла кромка рами й підвіконня (лінією, а не пунктиром — по крапці на
 * світовий піксель вони читались штрихами).
 */
export function windowHd(g: Ctx, x: number, y: number, w: number, h: number, frame: string, curtain: string): void {
  dot(g, x + 1.5, y + 0.5, '#ffffff');
  dot(g, x + 2, y + 1, '#e8f6fd');
  dot(g, x + w - 3, y + h - 1.5, '#e8f6fd');
  rect(g, x + 0.5, y + 0.5, 0.5, h - 0.5, shade(curtain, -0.18));
  rect(g, x + w - 1, y + 0.5, 0.5, h - 0.5, shade(curtain, -0.18));
  rect(g, x - 1, y - 1, w + 2, 0.5, shade(frame, 0.28));
  rect(g, x - 2, y + h + 1, w + 4, 0.5, shade(frame, 0.12));
}

/**
 * Двері: філенки зі світлим скосом угорі й ліворуч і тінню внизу й
 * праворуч, волокна дошок рисками вздовж (не сіткою крапок), кована
 * завіса з відблиском, світла кромка ручки.
 */
export function doorHd(g: Ctx, x: number, bottom: number, w: number, h: number): void {
  const y = bottom - h;
  const half = Math.floor(h / 2);
  for (const [py, ph] of [[y + 2, half - 2], [y + half + 1, half - 3]] as const) {
    if (ph < 2) continue;
    for (let k = 2; k < w - 2; k += 2) {
      const q = cellHash(k, py, 777);
      rect(g, x + k + (q % 2) * 0.5, py + 1 + (q % 3) * 0.5, 0.5, Math.max(1, ph - 2.5 - (q % 2) * 0.5), '#6e4426');
    }
    rect(g, x + 1, py, w - 2, 0.5, '#9a6a40');
    rect(g, x + 1, py, 0.5, ph, '#94643c');
    rect(g, x + 1, py + ph - 0.5, w - 2, 0.5, '#5e3820');
    rect(g, x + w - 1.5, py, 0.5, ph, '#5e3820');
  }
  for (const hy of [y + 2.5, y + h - 3.5]) {
    rect(g, x - 0.5, hy, 2, 0.5, '#3a3a40');
    dot(g, x, hy, '#8a8a92');
  }
  dot(g, x + w - 2, y + half + 0.5, '#fff1a8');
}

/** Квіти в ящику: чотирипелюсткові, з серединкою. */
export function flowerBoxHd(g: Ctx, x: number, y: number, w: number, season: Season): void {
  if (season === 'winter') return;
  const tones = ['#ff7aa8', '#f6d55c', '#e8576c', '#fbf2f5'];
  for (let k = 0; k < w; k += 2) {
    const c = tones[(k / 2) % tones.length]!;
    dot(g, x + k - 0.5, y - 1, c);
    dot(g, x + k + 0.5, y - 1, c);
    dot(g, x + k, y - 1.5, c);
    dot(g, x + k, y - 1, '#fff2a0');
  }
}

/** Мальва: квітка з п'ятьох пелюсток і темним вічком. */
export function mallowBloomHd(g: Ctx, x: number, y: number, c: string): void {
  dot(g, x - 1, y + 0.5, shade(c, 0.15));
  dot(g, x + 1.5, y + 0.5, shade(c, -0.15));
  dot(g, x + 0.5, y - 0.5, shade(c, 0.2));
  dot(g, x + 0.5, y + 1.5, shade(c, -0.2));
  dot(g, x + 0.5, y + 1, '#8a3a2a');
}

/**
 * Снігова шапка на даху: хвилястий нижній край — подекуди сніг звисає на
 * пів пікселя з тінню під собою. `rows` — рядки шапки (межі по х і рядок у
 * спрайті). Крапок усередині шапки немає: вони читались рисками на снігу.
 */
export function snowCapHd(g: Ctx, rows: readonly { x0: number; x1: number; y: number }[], seed: number): void {
  const last = rows[rows.length - 1];
  if (!last) return;
  for (let x = last.x0 + 1; x < last.x1 - 1; x += 0.5) {
    if (cellHash(Math.round(x * 2), seed, 52) % 3 !== 0) continue;
    dot(g, x, last.y + 1, '#dfe9f6');
    dot(g, x, last.y + 1.5, 'rgba(120,140,170,0.35)');
  }
}
