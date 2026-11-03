// ============================================================
// Одяг з шафи на аркушах людей (ADR-0239). Аркуш має одне вбрання, тож
// куплене перефарбовується тут: пікселі одягу отримують колір речі, а
// світлотінь лишається — яскравість кожного пікселя стоїть у тій самій
// пропорції до основного тону речі, що й була. Нових малюнків не треба.
//
// Де одяг — каже маска поруч з аркушем (`<хто>-mask.png`, у падінні й позах
// теж): червоний — верх, зелений — низ, синій — оздоблення. Маску робить
// `scripts/port/import_game1.py` з шару вбрання Godot-порту, без зачіски,
// голови й шкіри. За кольором тут не вгадати: теракотовий светр дорослої
// Лєни тієї самої барви, що її каштанове волосся.
//
// Чиста функція над RGBA — без canvas, тож перевіряється тестом.
// ============================================================
import { hexToRgb } from './pixel';

export type OutfitPart = 'top' | 'bottom' | 'accent';
export type OutfitColors = { [P in OutfitPart]?: string | undefined };

/** Частини в порядку каналів маски: червоний, зелений, синій. */
const PARTS: readonly OutfitPart[] = ['top', 'bottom', 'accent'];

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

/** Для кожного пікселя — номер частини (`PARTS`) за маскою RGBA, або -1. */
export function maskParts(mask: Uint8ClampedArray): Int8Array {
  const out = new Int8Array(mask.length / 4).fill(-1);
  for (let i = 0; i < out.length; i += 1) {
    if (mask[i * 4 + 3] === 0) continue;
    const k = [0, 1, 2].findIndex((c) => mask[i * 4 + c]! >= 128);
    out[i] = k;
  }
  return out;
}

/** Основний тон кожної частини — медіана яскравості її пікселів (1, якщо частини нема). */
export function maskReference(data: Uint8ClampedArray, mask: Uint8ClampedArray): number[] {
  const parts = maskParts(mask);
  return PARTS.map((_, k) => {
    const vs: number[] = [];
    for (let i = 0; i < parts.length; i += 1) if (parts[i] === k) vs.push(rgbToHsv(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)[2]);
    vs.sort((a, b) => a - b);
    return vs.length ? Math.max(vs[vs.length >> 1]!, 0.05) : 1;
  });
}

/**
 * Перефарбовує одяг на місці: колір частини з `colors`, світлотінь — та сама
 * пропорція до основного тону. Частину без кольору (`undefined`) не чіпає.
 * `ref` — основні тони з основного аркуша (для падіння й поз, де одягу
 * менше видно); без нього — з самих `data`.
 */
export function recolorByMask(data: Uint8ClampedArray, mask: Uint8ClampedArray, colors: OutfitColors, ref?: readonly number[]): void {
  if (data.length !== mask.length) throw new Error(`Перевдягання: маска ${mask.length / 4} px, аркуш ${data.length / 4} px`);
  const parts = maskParts(mask);
  const refV = ref ?? maskReference(data, mask);
  const target = PARTS.map((p) => {
    const hex = colors[p];
    return hex ? rgbToHsv(...hexToRgb(hex)) : null;
  });
  for (let i = 0; i < parts.length; i += 1) {
    const k = parts[i]!;
    if (k < 0 || data[i * 4 + 3] === 0) continue;
    const t = target[k];
    if (!t) continue;
    const v = rgbToHsv(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!)[2];
    const [r, g, b] = hsvToRgb(t[0], t[1], Math.min(1, (t[2] * v) / refV[k]!));
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
  }
}
