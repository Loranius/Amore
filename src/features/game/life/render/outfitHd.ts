// ============================================================
// Одяг з шафи на аркушах 32×32 (ADR-0239). Аркуш PixelLab має одне
// вбрання, тож куплене перефарбовується тут: пікселі одягу (знайдені за
// барвою й висотою в силуеті кадру) отримують колір речі, а світлотінь
// PixelLab лишається — яскравість кожного пікселя стоїть у тій самій
// пропорції до основного тону речі, що й була. Нових генерацій не треба.
//
// Висота рахується від стоп, а не від маківки: збоку хвіст стирчить вище
// голови, і смуга, відміряна від маківки, з'їжджала з плечей. Стопи ж у
// кожному кадрі на землі.
//
// Чиста функція над RGBA — без canvas, тож перевіряється тестом.
// ============================================================
import { hexToRgb } from './pixel';

/** Один тон речі: світло, тінь чи відблиск. Межі включні. */
export interface Tone {
  /** Барва 0..1; якщо `hue[0] > hue[1]`, проміжок переходить через 1. */
  hue?: readonly [number, number];
  minS?: number;
  maxS?: number;
  minV?: number;
  maxV?: number;
}

export interface Garment {
  /** Чий колір бере: верх, низ чи оздоблення (`look.top`, `look.bottom`, `look.accent`). */
  part: 'top' | 'bottom' | 'accent';
  /**
   * Смуга висоти, частки зросту: 0 — маківка, 1 — стопи. Зріст — силует
   * першого кадру аркуша («стоїть, униз»), відміряний у кожному кадрі від
   * його стоп.
   */
  band: readonly [number, number];
  /** Піксель належить речі, якщо підходить під будь-який з її тонів. */
  tones: readonly Tone[];
}

export type OutfitColors = { [P in Garment['part']]?: string | undefined };

type Hsv = [number, number, number];

function rgbToHsv(r: number, g: number, b: number): Hsv {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i]!;
  return [Math.round(r! * 255), Math.round(g! * 255), Math.round(b! * 255)];
}

function toneMatches(t: Tone, [h, s, v]: Hsv): boolean {
  if (t.hue) {
    const [a, b] = t.hue;
    if (a <= b ? h < a || h > b : h < a && h > b) return false;
  }
  return s >= (t.minS ?? 0) && s <= (t.maxS ?? 1) && v >= (t.minV ?? 0) && v <= (t.maxV ?? 1);
}

/** Найнижчий і найвищий непрозорий рядок клітинки, або `null`, якщо вона порожня. */
function rowsOf(data: Uint8ClampedArray, width: number, cx: number, cy: number, cell: number): [number, number] | null {
  let top = -1, bottom = -1;
  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      if (data[((cy + y) * width + cx + x) * 4 + 3]! > 0) {
        if (top < 0) top = y;
        bottom = y;
        break;
      }
    }
  }
  return top < 0 ? null : [top, bottom];
}

/** Для кожного пікселя — номер речі, якій він належить, або -1. */
export function garmentMap(data: Uint8ClampedArray, width: number, height: number, cell: number, garments: readonly Garment[]): Int8Array {
  const out = new Int8Array(width * height).fill(-1);
  const first = rowsOf(data, width, 0, 0, cell);
  if (!first || first[1] <= first[0]) return out;
  const stature = first[1] - first[0];
  for (let cy = 0; cy + cell <= height; cy += cell) {
    for (let cx = 0; cx + cell <= width; cx += cell) {
      const rows = rowsOf(data, width, cx, cy, cell);
      if (!rows) continue;
      const crown = rows[1] - stature;
      for (let y = rows[0]; y <= rows[1]; y += 1) {
        const rel = (y - crown) / stature;
        for (let x = 0; x < cell; x += 1) {
          const i = (cy + y) * width + cx + x;
          if (data[i * 4 + 3] === 0) continue;
          const hsv = rgbToHsv(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);
          const k = garments.findIndex((gm) => rel >= gm.band[0] && rel < gm.band[1] && gm.tones.some((t) => toneMatches(t, hsv)));
          if (k >= 0) out[i] = k;
        }
      }
    }
  }
  return out;
}

/** Основний тон кожної речі — медіана яскравості її пікселів. */
function referenceV(data: Uint8ClampedArray, map: Int8Array, garments: readonly Garment[]): number[] {
  return garments.map((_, k) => {
    const vs: number[] = [];
    for (let i = 0; i < map.length; i += 1) if (map[i] === k) vs.push(rgbToHsv(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)[2]);
    vs.sort((a, b) => a - b);
    return vs.length ? Math.max(vs[vs.length >> 1]!, 0.05) : 1;
  });
}

/** Перефарбувати пікселі за картою речей: колір речі, світлотінь — та сама пропорція до основного тону. */
function paint(data: Uint8ClampedArray, map: Int8Array, garments: readonly Garment[], colors: OutfitColors, refV: readonly number[]): void {
  const target = garments.map((gm) => {
    const hex = colors[gm.part];
    return hex ? rgbToHsv(...hexToRgb(hex)) : null;
  });
  for (let i = 0; i < map.length; i += 1) {
    const k = map[i]!;
    if (k < 0) continue;
    const t = target[k];
    if (!t) continue;
    const v = rgbToHsv(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)[2];
    const [r, g, b] = hsvToRgb(t[0], t[1], Math.min(1, (t[2] * v) / refV[k]!));
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
  }
}

/**
 * Перефарбовує одяг на аркуші на місці. `colors` — колір для кожної частини;
 * частину без кольору (`undefined`) не чіпає.
 */
export function recolorOutfit(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cell: number,
  garments: readonly Garment[],
  colors: OutfitColors,
): void {
  const map = garmentMap(data, width, height, cell, garments);
  paint(data, map, garments, colors, referenceV(data, map, garments));
}

/** Аркуш RGBA з його клітинкою. */
export interface SheetPixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  cell: number;
}

/**
 * Для кожного пікселя кадрів `frames` — номер речі або -1, за кольором.
 * Падіння (Лєна лежить) не має смуг висоти: відміряне від стоп «від маківки
 * до стоп» там лягає впоперек тіла. Тож річ упізнається за кольором: кожен
 * колір — тим, чим він найчастіше був на основному аркуші (`garmentMap`,
 * «стоїть і йде»). Колір, що на основному аркуші частіше не одяг (шкіра,
 * волосся, банти, очі), не перефарбовується ніде. Колір, якого на основному
 * аркуші немає (шаблон падіння малює свої відтінки), — річ, під тон якої він
 * підходить, без смуги. Найближчий колір тут не годиться: рожева сукня малої
 * близька до її шкіри, і шкіра ставала б сукнею.
 */
export function garmentMapByPalette(frames: SheetPixels, base: SheetPixels, garments: readonly Garment[]): Int8Array {
  const baseMap = garmentMap(base.data, base.width, base.height, base.cell, garments);
  const none = garments.length;
  const votes = new Map<number, number[]>();
  for (let i = 0; i < baseMap.length; i += 1) {
    if (base.data[i * 4 + 3] === 0) continue;
    const key = (base.data[i * 4]! << 16) | (base.data[i * 4 + 1]! << 8) | base.data[i * 4 + 2]!;
    let v = votes.get(key);
    if (!v) { v = new Array<number>(none + 1).fill(0); votes.set(key, v); }
    v[baseMap[i]! >= 0 ? baseMap[i]! : none]! += 1;
  }
  const owner = new Map<number, number>();
  for (const [key, v] of votes) {
    let best = none;
    for (let k = 0; k <= none; k += 1) if (v[k]! > v[best]!) best = k;
    owner.set(key, best === none ? -1 : best);
  }
  const byTone = (key: number): number => {
    const hsv = rgbToHsv(key >> 16, (key >> 8) & 255, key & 255);
    return garments.findIndex((gm) => gm.tones.some((t) => toneMatches(t, hsv)));
  };
  const out = new Int8Array(frames.width * frames.height).fill(-1);
  for (let i = 0; i < out.length; i += 1) {
    if (frames.data[i * 4 + 3] === 0) continue;
    const key = (frames.data[i * 4]! << 16) | (frames.data[i * 4 + 1]! << 8) | frames.data[i * 4 + 2]!;
    let k = owner.get(key);
    if (k === undefined) { k = byTone(key); owner.set(key, k); }
    out[i] = k;
  }
  return out;
}

/** Перефарбовує одяг на кадрах падіння за кольорами основного аркуша (`garmentMapByPalette`). */
export function recolorByPalette(frames: SheetPixels, base: SheetPixels, garments: readonly Garment[], colors: OutfitColors): void {
  const map = garmentMapByPalette(frames, base, garments);
  const baseMap = garmentMap(base.data, base.width, base.height, base.cell, garments);
  paint(frames.data, map, garments, colors, referenceV(base.data, baseMap, garments));
}
