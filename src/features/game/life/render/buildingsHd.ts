// ============================================================
// Деталі будинків у 32×32 (ADR-0239, власник 2026-10-06). Основа — та
// сама, що в 16×16 (`buildings.ts`), а тут — пів-пікселі, яких у 16×16
// немає місця: окремі стебла соломи, заокруглений край кожної черепиці,
// відблиск на бляшаних ребрах, фактура штукатурки й дошок, складки фіранок,
// волокна дверей, пелюстки квітів.
// ============================================================
import type { Season } from '../sim/calendar';
import { cellHash, dot, mix, shade, type Ctx } from './pixel';

type RoofKind = 'thatch' | 'tile' | 'flat' | 'metal' | 'none';

const m = (v: number, n: number) => ((v % n) + n) % n;

/** Один ряд даху: `y` — рядок у спрайті, `ry` — у світі (шви тягнуться через стики крил). */
export function roofRowHd(g: Ctx, kind: RoofKind, color: string, x0: number, x1: number, y: number, ry: number, atX: number, cs: number): void {
  if (kind === 'thatch') {
    // Стебла соломи звисають пасмами: світлий кінчик і темна тінь під ним.
    // Пасма йдуть рядами по 3 світові пікселі, як шари стріхи.
    const light = mix(color, '#f6e6a8', 0.45);
    const dark = shade(color, -0.24);
    const layer = m(ry, 3);
    for (let x = x0; x < x1; x += 0.5) {
      const hh = cellHash(Math.round((atX + x) * 2), Math.floor(ry / 3), cs) % 7;
      if (hh === 0 || hh === 3) dot(g, x, y + (layer === 0 ? 0 : 0.5), layer === 2 ? dark : light);
      else if (hh === 5 && layer !== 1) dot(g, x, y + 0.5, dark);
    }
  } else if (kind === 'tile') {
    const band = Math.floor(ry / 4);
    const off = m(band, 2) === 0 ? 0 : 3;
    const row = m(ry, 4);
    for (let x = Math.ceil(x0); x < x1; x += 1) {
      const t = m(atX + x - off, 6);
      // Відблиск на верхньому лівому краї луски й заокруглення знизу.
      if (row === 0 && t === 1) dot(g, x + 0.5, y + 0.5, shade(color, 0.32));
      if (row === 2 && t === 0) dot(g, x + 0.5, y + 0.5, shade(color, -0.32));
      if (row === 2 && t === 5) dot(g, x, y + 0.5, shade(color, -0.32));
      if (row === 1 && t === 3) dot(g, x, y, shade(color, 0.08));
    }
  } else if (kind === 'metal') {
    for (let x = Math.ceil(x0); x < x1; x += 1) if (m(atX + x - 2, 5) === 0 && m(ry, 4) !== 3) dot(g, x + 1, y, shade(color, 0.22));
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
    for (let r = 0; r < H; r += 4) {
      for (let k = 0; k < W / 9; k += 1) {
        const h = cellHash(k, r, seed);
        const x = 4 + (h % ((W - 9) * 2)) / 2;
        dot(g, x, top + r + 1.5, shade(color, -0.16));
        dot(g, x + 0.5, top + r + 1.5, shade(color, -0.12));
        dot(g, x + 1, top + r + 1.5, shade(color, -0.08));
      }
      dot(g, 4, top + r + 1, '#5a5a62');
      dot(g, W - 5, top + r + 1, '#5a5a62');
    }
  } else if (material === 'brick') {
    for (let r = 0; r < H; r += 3) dot(g, 4 + (cellHash(r, seed, 5) % (W - 8)), top + r + 0.5, shade(color, 0.18));
  }
}

/** Вікно: подвійний відблиск на склі, складки фіранок, світла кромка рами й підвіконня. */
export function windowHd(g: Ctx, x: number, y: number, w: number, h: number, frame: string, curtain: string): void {
  dot(g, x + 1.5, y + 0.5, '#ffffff');
  dot(g, x + 2, y + 1, '#e8f6fd');
  dot(g, x + w - 3, y + h - 1.5, '#e8f6fd');
  for (let r = 0.5; r < h; r += 1) {
    dot(g, x + 0.5, y + r, shade(curtain, -0.18));
    dot(g, x + w - 1, y + r, shade(curtain, -0.18));
  }
  for (let k = 0; k < w + 2; k += 1) dot(g, x - 1 + k, y - 1, shade(frame, 0.28));
  for (let k = 0; k < w + 4; k += 1) dot(g, x - 2 + k, y + h + 1, shade(frame, 0.12));
}

/** Двері: волокна дошок, завіси, світла кромка ручки. */
export function doorHd(g: Ctx, x: number, bottom: number, w: number, h: number): void {
  const y = bottom - h;
  for (let k = 1.5; k < w - 1; k += 2.5) for (let r = 1; r < h - 1; r += 3) dot(g, x + k, y + r + (k % 2), '#6e4426');
  dot(g, x + 0.5, y + 2.5, '#3a3a40');
  dot(g, x + 0.5, y + h - 3.5, '#3a3a40');
  dot(g, x + w - 2, y + Math.floor(h / 2) + 0.5, '#fff1a8');
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
