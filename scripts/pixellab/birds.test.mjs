// Аркуш курей і півня 32×32 (ADR-0239) — перевірка самого PNG.
// Людей перевіряє `scripts/port/people.test.mjs`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../live/luminance.mjs';

const DIR = 'src/features/game/life/render/assets/hd';

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
import { BIRD_CELL, BIRD_KINDS, BIRD_PECK_FRAMES, BIRD_WALK_FRAMES, birdCell } from '../../src/features/game/life/render/birds.ts';
import { newBird, stepBird } from '../../src/features/game/life/sim/birds.ts';

// Аркуш лише один, 32×32 (власник 2026-10-31: «повністю відмовляємось від 16×16»).
const BIRD_SHEETS = [{ name: '32×32', file: `${DIR}/birds.png`, cell: BIRD_CELL }];
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
    const cell = BIRD_CELL;
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
    const cell = BIRD_CELL;
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

