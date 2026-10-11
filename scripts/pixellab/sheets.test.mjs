// ============================================================
// Аркуші людей 32×32 (ADR-0239) — перевірка самих PNG, а не коду, що їх
// малює. Тут те, що вже раз зламалось і чого не видно з одного живого
// кадру:
//
// - PixelLab намалював останній кадр ходи «униз» підлітка спиною, і він
//   блимав кожен четвертий крок, поки його не перегенерували;
// - PixelLab малює Лєні блакитні очі, навіть коли просиш карі
//   (`build_sheet.py`, крок `eyes`);
// - у ході «угору» перемальованого підлітка хвіст був лише в одному кадрі
//   з чотирьох і блимав — ці кадри взято з `skeleton-v3`, що рухає готовий
//   малюнок, а не малює заново;
// - перевдягання (`outfitHd.ts`) мусить знайти одяг у КОЖНОМУ кадрі —
//   збоку й зі спини теж — і не зачепити голову чи взуття.
// ============================================================
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../live/luminance.mjs';
import { recolorOutfit } from '../../src/features/game/life/render/outfitHd.ts';
import { ADULT_DRESS, KID_DRESS, TEEN_CLOTHES } from '../../src/features/game/life/render/peopleHd.ts';

const DIR = 'src/features/game/life/render/assets/hd';
/** Рядки аркуша: униз, ліворуч, праворуч, угору. */
const SOUTH = 0;
const NORTH = 3;

const PEOPLE = [
  { name: 'lena-kid', cell: 68 },
  { name: 'lena-teen', cell: 80 },
  { name: 'lena-adult', cell: 92 },
  { name: 'mom', cell: 92 },
  { name: 'dima', cell: 92 },
];

function hsv(r, g, b) {
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
  return [h, max ? d / max : 0, max];
}

function load(name) {
  const img = decodePng(readFileSync(`${DIR}/${name}.png`));
  if (img.channels !== 4) throw new Error(`${name}: аркуш має бути RGBA`);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/**
 * Кожен піксель кожного кадру з його висотою: 0 — маківка, 1 — стопи,
 * зріст — силует першого кадру, відміряний від стоп кадру (як у `outfitHd.ts`).
 */
function* pixels(sheet, cell) {
  const { width, data } = sheet;
  const rowsOf = (cx, cy) => {
    let top = -1, bottom = -1;
    for (let y = 0; y < cell; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        if (data[((cy + y) * width + cx + x) * 4 + 3] > 0) {
          if (top < 0) top = y;
          bottom = y;
          break;
        }
      }
    }
    return [top, bottom];
  };
  const [t0, b0] = rowsOf(0, 0);
  const stature = b0 - t0;
  for (let cy = 0; cy < sheet.height; cy += cell) {
    for (let cx = 0; cx < width; cx += cell) {
      const [top, bottom] = rowsOf(cx, cy);
      const crown = bottom - stature;
      for (let y = top; y <= bottom; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const i = ((cy + y) * width + cx + x) * 4;
          if (data[i + 3] === 0) continue;
          yield { row: cy / cell, col: cx / cell, rel: (y - crown) / stature, i, hsv: hsv(data[i], data[i + 1], data[i + 2]) };
        }
      }
    }
  }
}

/** Світла шкіра обличчя: зі спини її майже не видно — там волосся. */
const isFaceSkin = ([h, s, v]) => (h <= 0.1 || h >= 0.97) && s >= 0.12 && s <= 0.45 && v >= 0.85;

describe('Аркуші людей 32×32', () => {
  it.each(PEOPLE)('$name: кожен кадр «униз» і вбік показує обличчя, «угору» — потилицю', ({ name, cell }) => {
    const sheet = load(name);
    const face = new Map();
    for (const p of pixels(sheet, cell)) {
      if (p.rel < 0.12 || p.rel >= 0.34 || !isFaceSkin(p.hsv)) continue;
      const key = `${p.row}:${p.col}`;
      face.set(key, (face.get(key) ?? 0) + 1);
    }
    const idle = face.get(`${SOUTH}:0`) ?? 0;
    expect(idle).toBeGreaterThan(40);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const n = face.get(`${row}:${col}`) ?? 0;
        const where = `${name}, рядок ${row}, кадр ${col}: ${n} пікселів обличчя проти ${idle}`;
        if (row === NORTH) expect(n, where).toBeLessThanOrEqual(idle * 0.3);
        else expect(n, where).toBeGreaterThanOrEqual(idle * 0.5);
      }
    }
  });

  // Лише Лєна: у неї одяг за кольором не схожий на волосся. У Діми червоний
  // каптур на потилиці рахувався б волоссям.
  it.each(PEOPLE.slice(0, 3))('$name: зі спини волосся видно в кожному кадрі ходи', ({ name, cell }) => {
    const nape = new Map();
    for (const p of pixels(load(name), cell)) {
      const [h, s, v] = p.hsv;
      if (p.row !== NORTH || p.rel < 0.28 || p.rel >= 0.5 || h > 0.1 || s < 0.3 || v > 0.75) continue;
      nape.set(p.col, (nape.get(p.col) ?? 0) + 1);
    }
    const idle = nape.get(0) ?? 0;
    expect(idle).toBeGreaterThan(20);
    for (let col = 1; col < 5; col += 1) {
      const n = nape.get(col) ?? 0;
      expect(n, `${name}, кадр ${col} «угору»: ${n} пікселів волосся на потилиці проти ${idle}`).toBeGreaterThanOrEqual(idle * 0.55);
    }
  });

  it.each(PEOPLE.slice(0, 3))('$name: очі карі в кожному кадрі з обличчям', ({ name, cell }) => {
    const blue = [];
    for (const p of pixels(load(name), cell)) {
      const [h, s] = p.hsv;
      if (p.row !== NORTH && p.rel >= 0.17 && p.rel < 0.31 && h > 0.5 && h < 0.75 && s > 0.15) blue.push(`${p.row}:${p.col}@${p.rel.toFixed(2)}`);
    }
    expect(blue).toEqual([]);
  });
});

// Чим перевдягати: три кольори, яких на аркушах немає, — щоб кожну частину
// було видно окремо.
const PROBE = { top: '#2e8b57', bottom: '#7a4a2a', accent: '#d0309a' };

const LENA = [
  // Що лишилося б від намальованого одягу, якби його не знайшли.
  { name: 'lena-kid', cell: 68, garments: KID_DRESS, band: [0.36, 0.84], original: ([h, s, v]) => h > 0.85 && h < 0.955 && s > 0.3 && v > 0.5 },
  { name: 'lena-teen', cell: 80, garments: TEEN_CLOTHES, band: [0.4, 0.62], original: ([, s, v]) => s < 0.12 && v > 0.75 },
  { name: 'lena-adult', cell: 92, garments: ADULT_DRESS, band: [0.4, 0.93], original: ([h, s]) => h > 0.5 && h < 0.75 && s > 0.05 },
];

describe('Перевдягання на справжніх аркушах Лєни', () => {
  it.each(LENA)('$name: одяг перефарбовано в кожному кадрі, голова й взуття — свої', ({ name, cell, garments, band, original }) => {
    const before = load(name);
    const after = { ...before, data: new Uint8ClampedArray(before.data) };
    recolorOutfit(after.data, after.width, after.height, cell, garments, PROBE);
    const share = new Map();
    const head = [];
    const feet = [];
    const left = [];
    for (const p of pixels(before, cell)) {
      const changed = [0, 1, 2].some((k) => before.data[p.i + k] !== after.data[p.i + k]);
      const key = `${p.row}:${p.col}`;
      const [n, all] = share.get(key) ?? [0, 0];
      share.set(key, [n + (changed ? 1 : 0), all + 1]);
      if (changed && p.rel < 0.34) head.push(key);
      if (changed && p.rel >= 0.97) feet.push(key);
      if (!changed && p.rel >= band[0] && p.rel < band[1] && original(p.hsv)) left.push(`${key}@${p.rel.toFixed(2)}`);
    }
    expect(head, 'голова, волосся, очі, банти й гумка не фарбуються').toEqual([]);
    expect(feet, 'взуття не фарбується').toEqual([]);
    expect(left, 'від намальованого одягу нічого не лишилось').toEqual([]);
    for (const [key, [n, all]] of share) expect(n / all, `кадр ${key}: одяг знайдено`).toBeGreaterThan(0.1);
  });
});
