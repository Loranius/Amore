// ============================================================
// Аркуші людей 32×32 (ADR-0239) — перевірка самих PNG, а не коду, що їх
// малює. Тут те, що вже раз зламалось і чого не видно з одного живого
// кадру:
//
// - PixelLab намалював останній кадр ходи «униз» підлітка спиною, і він
//   блимав кожен четвертий крок, поки його не перегенерували;
// - PixelLab малює Лєні блакитні очі, навіть коли просиш карі
//   (`build_sheet.py`, крок `eyes`);
// - у перемальованого підлітка очі були різні в кожному кадрі: відблиск
//   стрибав, а в одному кадрі око лишилось без білого зовсім; тепер очі
//   поставлені за шаблоном (`build_sheet.py`, крок `face`);
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

  // Очі їдуть разом із головою, тож тут висота — від маківки кадру, а не
  // від стоп: у ході стопи стрибають на кілька пікселів.
  it.each(PEOPLE.slice(0, 3))('$name: у кожному кадрі з обличчям кожне око має біле', ({ name, cell }) => {
    const sheet = load(name);
    const { width, data } = sheet;
    const isWhite = (i) => {
      const [, s, v] = hsv(data[i], data[i + 1], data[i + 2]);
      return data[i + 3] > 0 && s < 0.12 && v > 0.75;
    };
    for (let row = 0; row < NORTH; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        let top = -1, left = cell, right = -1;
        for (let y = 0; y < cell; y += 1) {
          for (let x = 0; x < cell; x += 1) {
            if (data[((row * cell + y) * width + col * cell + x) * 4 + 3] === 0) continue;
            if (top < 0) top = y;
            left = Math.min(left, x);
            right = Math.max(right, x);
          }
        }
        const mid = (left + right + 1) / 2;
        let leftEye = 0, rightEye = 0;
        for (let y = top + 9; y <= top + 16; y += 1) {
          for (let x = left; x <= right; x += 1) {
            if (!isWhite(((row * cell + y) * width + col * cell + x) * 4)) continue;
            if (x < mid) leftEye += 1;
            else rightEye += 1;
          }
        }
        const where = `${name}, рядок ${row}, кадр ${col}: біле ${leftEye} ліворуч і ${rightEye} праворуч`;
        if (row === SOUTH) {
          expect(leftEye, where).toBeGreaterThan(0);
          expect(rightEye, where).toBeGreaterThan(0);
        } else {
          expect(leftEye + rightEye, where).toBeGreaterThan(0);
        }
      }
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

// ============================================================
// Кури й півень (власник, 2026-10-12): аркуші `build_birds.py` з кадрів
// PixelLab. Тут те, що з одного живого кадру не видно:
//
// - поведінка (`sim/birds.ts`) обирає кадр, а аркуш його мусить мати — і
//   навпаки, порожні лише ті клітинки, яких поведінка не обирає ніколи
//   (півень ходить лише профілем, дзьобають усі профілем);
// - шаблон людської ходи малював курям під лапами білі «черевики»;
// - PixelLab намалював білу курку й півня без обвідки, а коричневу — з нею;
// - v3 малює біля дзьоба крихти окремими цятками.
// ============================================================
import { BIRD_CELL, BIRD_HD_CELL, BIRD_KINDS, BIRD_PECK_FRAMES, BIRD_WALK_FRAMES, birdCell } from '../../src/features/game/life/render/birds.ts';
import { newBird, stepBird } from '../../src/features/game/life/sim/birds.ts';

const BIRD_SHEETS = [
  { name: '32×32', file: `${DIR}/birds.png`, cell: BIRD_HD_CELL },
  { name: '16×16', file: 'src/features/game/life/render/assets/birds.png', cell: BIRD_CELL },
];
const BIRD_COLS = 1 + BIRD_WALK_FRAMES + BIRD_PECK_FRAMES;

function loadFile(file) {
  const img = decodePng(readFileSync(file));
  if (img.channels !== 4) throw new Error(`${file}: аркуш має бути RGBA`);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}

/** Непрозорі пікселі клітинки: [x, y, i] у межах клітинки. */
function cellPixels(sheet, cell, row, col) {
  const out = [];
  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      const i = ((row * cell + y) * sheet.width + col * cell + x) * 4;
      if (sheet.data[i + 3] > 0) out.push([x, y, i]);
    }
  }
  return out;
}

/** Які клітинки поведінка справді обирає: кожна птаха 10 хвилин, а довкола ходить Лєна. */
function usedCells() {
  const used = new Set();
  for (const kind of BIRD_KINDS) {
    for (const seed of [1, 2, 3]) {
      let b = newBird(kind, 300, 200, seed);
      const dt = 1 / 30;
      for (let t = 0; t < 600; t += dt) {
        // Лєна раз на пів хвилини проходить повз — птаха тікає.
        const lena = { x: 300 + Math.cos(t / 5) * 40, y: 200 + Math.sin(t / 5) * 15 };
        b = stepBird(b, dt, { scare: t % 30 < 6 ? [lena] : [], canStand: (x, y) => x > 0 && y > 0 && x < 600 && y < 400 });
        const { row, col } = birdCell(b);
        used.add(`${row}:${col}`);
      }
    }
  }
  return used;
}

describe('Аркуші курей і півня', () => {
  const used = usedCells();

  it.each(BIRD_SHEETS)('$name: намальовано рівно ті кадри, які обирає поведінка', ({ file, cell }) => {
    const sheet = loadFile(file);
    expect(sheet.width).toBe(cell * BIRD_COLS);
    expect(sheet.height).toBe(cell * 4 * BIRD_KINDS.length);
    const drawn = new Set();
    for (let row = 0; row < 4 * BIRD_KINDS.length; row += 1) {
      for (let col = 0; col < BIRD_COLS; col += 1) if (cellPixels(sheet, cell, row, col).length > 0) drawn.add(`${row}:${col}`);
    }
    expect([...used].filter((k) => !drawn.has(k)), 'поведінка обирає порожню клітинку').toEqual([]);
    expect([...drawn].filter((k) => !used.has(k)), 'намальовано кадр, якого поведінка не обирає').toEqual([]);
  });

  it.each(BIRD_SHEETS)('$name: лапи кожного кадру — на одній лінії, птаха ціла в клітинці', ({ file, cell }) => {
    const sheet = loadFile(file);
    for (const key of used) {
      const [row, col] = key.split(':').map(Number);
      const px = cellPixels(sheet, cell, row, col);
      const bottom = Math.max(...px.map(([, y]) => y));
      const top = Math.min(...px.map(([, y]) => y));
      const where = `${BIRD_KINDS[Math.floor(row / 4)]}, рядок ${row % 4}, кадр ${col}: лапи на ${bottom}`;
      expect(Math.abs(bottom - cell * 0.875), where).toBeLessThanOrEqual(cell * 0.075);
      expect(top, where).toBeGreaterThan(0);
    }
  });

  it('32×32: усі три птахи з темною обвідкою, без окремих цяток', () => {
    const sheet = loadFile(BIRD_SHEETS[0].file);
    const cell = BIRD_HD_CELL;
    for (const key of used) {
      const [row, col] = key.split(':').map(Number);
      const px = cellPixels(sheet, cell, row, col);
      const solid = new Set(px.map(([x, y]) => `${x},${y}`));
      let edge = 0;
      let dark = 0;
      for (const [x, y, i] of px) {
        if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solid.has(`${x + dx},${y + dy}`))) continue;
        edge += 1;
        if (hsv(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2])[2] < 0.25) dark += 1;
      }
      const where = `${BIRD_KINDS[Math.floor(row / 4)]}, рядок ${row % 4}, кадр ${col}`;
      expect(dark / edge, `${where}: темних на краю ${dark} з ${edge}`).toBeGreaterThan(0.9);
      // Одна птаха — один острів пікселів (сусіди й по діагоналі).
      const seen = new Set();
      let islands = 0;
      for (const [x, y] of px) {
        if (seen.has(`${x},${y}`)) continue;
        islands += 1;
        const stack = [[x, y]];
        seen.add(`${x},${y}`);
        while (stack.length > 0) {
          const [cx, cy] = stack.pop();
          for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
              const k = `${cx + dx},${cy + dy}`;
              if (solid.has(k) && !seen.has(k)) { seen.add(k); stack.push([cx + dx, cy + dy]); }
            }
          }
        }
      }
      expect(islands, where).toBe(1);
    }
  });

  it('32×32: під лапами немає білих «черевиків» із шаблону людської ходи', () => {
    const sheet = loadFile(BIRD_SHEETS[0].file);
    const cell = BIRD_HD_CELL;
    const white = (i) => { const [, s, v] = hsv(sheet.data[i], sheet.data[i + 1], sheet.data[i + 2]); return s < 0.18 && v > 0.78; };
    const found = [];
    for (const key of used) {
      const [row, col] = key.split(':').map(Number);
      const kind = BIRD_KINDS[Math.floor(row / 4)];
      const dir = row % 4;
      const px = cellPixels(sheet, cell, row, col);
      const bottom = Math.max(...px.map(([, y]) => y));
      for (const [x, y, i] of px) {
        // Коричнева курка анфас і зі спини не має білого зовсім; біла — на лапах.
        if (kind === 'brown' && (dir === 0 || dir === 3) && white(i)) found.push(`${key} ${x},${y}`);
        if (kind === 'white' && (dir === 0 || dir === 3) && y >= bottom - 3 && white(i)) found.push(`${key} ${x},${y}`);
      }
    }
    expect(found).toEqual([]);
  });
});

// ============================================================
// Падіння Лєни від Басі (власник, 2026-10-13: «створи анімацію падіння
// від Басі для Лєни»): смуги `build_sheet.py` у режимі "strip" — 7 кадрів
// падіння навзнак (шаблон PixelLab `falling-back-death`) і 5 підйому
// (`getting-up`), «праворуч». Тут те, чого не видно з одного живого кадру:
//
// - кадри лежать на тому самому полотні, що й аркуш людини: підвівшись,
//   Лєна стоїть там само, де стояла «праворуч» на аркуші ходи, — інакше
//   вона стрибала б, щойно рушить;
// - PixelLab малює Лєні блакитні очі й у падінні (малій — яскраво-блакитні);
// - куплений одяг перефарбовується й лежачи — за кольорами основного
//   аркуша (`garmentMapByPalette`), бо смуги висоти поперек лежачої Лєни
//   не діють; шкіра й волосся — ні.
// ============================================================
import { FALL_DOWN_FRAMES, FALL_UP_FRAMES } from '../../src/features/game/life/render/peopleHd.ts';
import { garmentMapByPalette } from '../../src/features/game/life/render/outfitHd.ts';

const FALLS = [
  { name: 'lena-kid', cell: 68, garments: KID_DRESS },
  { name: 'lena-teen', cell: 80, garments: TEEN_CLOTHES },
  { name: 'lena-adult', cell: 92, garments: ADULT_DRESS },
];
const FALL_COLS = FALL_DOWN_FRAMES + FALL_UP_FRAMES;

/** Межі силуету клітинки (`row`, `col`). */
function boxOf(sheet, cell, col, row = 0) {
  let left = cell, right = -1, top = cell, bottom = -1;
  for (let y = 0; y < cell; y += 1) {
    for (let x = 0; x < cell; x += 1) {
      if (sheet.data[((row * cell + y) * sheet.width + col * cell + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return { left, right, top, bottom, w: right - left + 1, h: bottom - top + 1, cx: (left + right) / 2 };
}

const isBluish = ([h, s, v]) => h > 0.5 && h < 0.75 && s > 0.08 && v > 0.3;

describe('Падіння Лєни 32×32', () => {
  it.each(FALLS)('$name: 12 кадрів; лягає навзнак і підводиться туди ж, де стояла', ({ name, cell }) => {
    const strip = load(`${name}-fall`);
    expect(strip.width).toBe(cell * FALL_COLS);
    expect(strip.height).toBe(cell);
    for (let col = 0; col < FALL_COLS; col += 1) expect(boxOf(strip, cell, col).w, `кадр ${col}`).toBeGreaterThan(0);
    const first = boxOf(strip, cell, 0);
    const lying = boxOf(strip, cell, FALL_DOWN_FRAMES - 1);
    const last = boxOf(strip, cell, FALL_COLS - 1);
    expect(first.h).toBeGreaterThan(first.w);
    expect(lying.w, 'лежить пласко').toBeGreaterThan(lying.h * 1.4);
    // Підвелась — стоїть, як «праворуч» на аркуші ходи (рядок 2, кадр 0).
    const stand = boxOf(load(name), cell, 0, 2);
    expect(Math.abs(last.bottom - stand.bottom), 'стопи на тій самій лінії').toBeLessThanOrEqual(2);
    expect(Math.abs(last.cx - stand.cx), 'на тому самому місці').toBeLessThanOrEqual(4);
    expect(Math.abs(last.h - stand.h), 'на повний зріст').toBeLessThanOrEqual(5);
  });

  it.each(FALLS)('$name: очі карі в кожному кадрі падіння', ({ name, cell }) => {
    const strip = load(`${name}-fall`);
    const { width, data } = strip;
    const at = (x, y) => ((y) * width + x) * 4;
    // Голова — там, де волосся: кольори волосся — каштанові пікселі верхніх
    // 15% силуету «праворуч» на аркуші ходи (як у `build_sheet.py`). Без
    // цього за очі сходять джинси й манжети біля рук підлітка.
    const base = load(name);
    const stand = boxOf(base, cell, 0, 2);
    const hair = new Set();
    for (let y = stand.top; y <= stand.top + stand.h * 0.15; y += 1) {
      for (let x = 0; x < cell; x += 1) {
        const i = ((2 * cell + y) * base.width + x) * 4;
        const [h, s, v] = hsv(base.data[i], base.data[i + 1], base.data[i + 2]);
        if (base.data[i + 3] > 0 && h >= 0.02 && h <= 0.12 && s >= 0.25 && v <= 0.85) hair.add(`${base.data[i]},${base.data[i + 1]},${base.data[i + 2]}`);
      }
    }
    expect(hair.size).toBeGreaterThan(2);
    const found = [];
    for (let col = 0; col < FALL_COLS; col += 1) {
      let hx0 = cell, hy0 = cell, hx1 = -1, hy1 = -1;
      for (let y = 0; y < cell; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const i = at(col * cell + x, y);
          if (data[i + 3] === 0 || !hair.has(`${data[i]},${data[i + 1]},${data[i + 2]}`)) continue;
          hx0 = Math.min(hx0, x); hy0 = Math.min(hy0, y); hx1 = Math.max(hx1, x); hy1 = Math.max(hy1, y);
        }
      }
      expect(hx1, `кадр ${col}: волосся видно`).toBeGreaterThanOrEqual(0);
      const inHead = ([a, b]) => a >= hx0 - 2 && a <= hx1 + 2 && b >= hy0 - 2 && b <= hy1 + 2;
      const seen = new Set();
      for (let y = 0; y < cell; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const i = at(col * cell + x, y);
          if (seen.has(`${x},${y}`) || data[i + 3] === 0 || !isBluish(hsv(data[i], data[i + 1], data[i + 2]))) continue;
          // Острівець синюватих пікселів…
          const comp = [];
          const stack = [[x, y]];
          seen.add(`${x},${y}`);
          while (stack.length > 0) {
            const [a, b] = stack.pop();
            comp.push([a, b]);
            for (let dx = -1; dx <= 1; dx += 1) {
              for (let dy = -1; dy <= 1; dy += 1) {
                const nx = a + dx, ny = b + dy;
                if (nx < 0 || ny < 0 || nx >= cell || ny >= cell || seen.has(`${nx},${ny}`)) continue;
                const j = at(col * cell + nx, ny);
                if (data[j + 3] > 0 && isBluish(hsv(data[j], data[j + 1], data[j + 2]))) { seen.add(`${nx},${ny}`); stack.push([nx, ny]); }
              }
            }
          }
          if (comp.length > 6 || !comp.every(inHead)) continue;
          // …посеред обличчя — це око.
          const skin = new Set();
          for (const [a, b] of comp) {
            for (let dx = -3; dx <= 3; dx += 1) {
              for (let dy = -3; dy <= 3; dy += 1) {
                const nx = a + dx, ny = b + dy;
                if (nx < 0 || ny < 0 || nx >= cell || ny >= cell) continue;
                const j = at(col * cell + nx, ny);
                const [h, s, v] = hsv(data[j], data[j + 1], data[j + 2]);
                if (data[j + 3] > 0 && (h <= 0.1 || h >= 0.97) && s >= 0.12 && s <= 0.5 && v >= 0.7) skin.add(`${nx},${ny}`);
              }
            }
          }
          if (skin.size >= 8) found.push(`кадр ${col}: ${comp.map(([a, b]) => `${a},${b}`).join(' ')}`);
        }
      }
    }
    expect(found).toEqual([]);
  });

  it.each(FALLS)('$name: куплений одяг перефарбовується й лежачи, а шкіра й волосся — ні', ({ name, cell, garments }) => {
    const strip = load(`${name}-fall`);
    const base = load(name);
    const map = garmentMapByPalette({ ...strip, cell }, { ...base, cell }, garments);
    const skinOrHair = [];
    for (let col = 0; col < FALL_COLS; col += 1) {
      let dressed = 0, all = 0;
      for (let y = 0; y < cell; y += 1) {
        for (let x = 0; x < cell; x += 1) {
          const p = y * strip.width + col * cell + x;
          if (strip.data[p * 4 + 3] === 0) continue;
          all += 1;
          if (map[p] < 0) continue;
          dressed += 1;
          const [h, s, v] = hsv(strip.data[p * 4], strip.data[p * 4 + 1], strip.data[p * 4 + 2]);
          if (isFaceSkin([h, s, v]) || (h >= 0.02 && h <= 0.12 && s >= 0.3 && v <= 0.6)) skinOrHair.push(`кадр ${col}: ${x},${y}`);
        }
      }
      expect(dressed / all, `кадр ${col}: одяг знайдено`).toBeGreaterThan(0.1);
    }
    expect(skinOrHair, 'шкіра й волосся не фарбуються').toEqual([]);
  });
});
