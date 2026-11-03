// ============================================================
// Аркуші людей з Godot-порту (ADR-0239, `scripts/port/import_game1.py`) —
// перевірка самих PNG, а не коду, що їх малює. Тут те, чого не видно з
// одного живого кадру:
//
// - стопи на одній лінії (у ході — як дозволяє порт), інакше людина
//   підстрибує на ходу;
// - маска одягу Лєни (за нею перефарбовується одяг із шафи) має одяг у
//   КОЖНОМУ кадрі — збоку й зі спини теж — і не лізе на голову;
// - падіння домальоване поворотом кадру «праворуч»: кадри лежать на лінії
//   стоп, лежача Лєна вміщається в клітинку, а підвівшись, стоїть так само,
//   як на аркуші ходи;
// - кошик у міні-іграх кладеться в точку долоні з `port.json` — там мусить
//   бути долоня.
// ============================================================
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../live/luminance.mjs';
import { FALL_DOWN_FRAMES, FALL_UP_FRAMES, FOLK, PORT_CELL, PORT_SCALE, POSE_NAMES } from '../../src/features/game/life/render/peopleHd.ts';

const DIR = 'src/features/game/life/render/assets/hd';
const PORT = JSON.parse(readFileSync(`${DIR}/port.json`, 'utf8'));
const CELL = PORT_CELL;
const COLS = 9;
const K = PORT_SCALE;
const FOOT_X = 27.5 * K;
const FOOT_Y = 52 * K;
const HEAD_ROWS = 13 * K;
const LENA = ['lena-kid', 'lena-teen', 'lena-adult'];
const MAIN = [...LENA, 'mom', 'dima', 'olya-kid', 'olya-teen', 'dima-kid', 'vlad-kid', 'dima-mom', 'dima-dad'];

function load(file) {
  const img = decodePng(readFileSync(`${DIR}/${file}.png`));
  if (img.channels !== 4) throw new Error(`${file}: аркуш має бути RGBA`);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
}
const alpha = (img, x, y) => img.data[(y * img.width + x) * 4 + 3];
const rgb = (img, x, y) => [...img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 3)];

/** Межі силуету клітинки (`col`, `row`), або `null`, якщо порожня. */
function boxOf(img, col, row = 0) {
  let x0 = CELL, y0 = CELL, x1 = -1, y1 = -1;
  for (let y = 0; y < CELL; y += 1) {
    for (let x = 0; x < CELL; x += 1) {
      if (!alpha(img, col * CELL + x, row * CELL + y)) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Шкіра порту: тепла, світла, не надто насичена. */
function isSkin([r, g, b]) {
  return r > 190 && g > 120 && g < 215 && b > 80 && b < 180 && r > g && g > b;
}

describe('Аркуші людей порту', () => {
  it('кожен аркуш мешканця з таблиці є, і зайвих нема', () => {
    const files = readdirSync(`${DIR}/folk`).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
    expect(files).toEqual(Object.keys(FOLK).sort());
  });

  it.each([...MAIN, ...Object.keys(FOLK).map((n) => `folk/${n}`)])('%s: 9 кадрів × 4 напрямки, стопи на лінії (у ході — ±1 рядок, як у порту)', (name) => {
    const img = load(name);
    expect([img.width, img.height]).toEqual([CELL * COLS, CELL * 4]);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const b = boxOf(img, col, row);
        expect(b, `${name} ${row}/${col}: порожній кадр`).not.toBeNull();
        // Як у порту (`test_body56.py`): у ході стопа може бути на рядок вище
        // чи нижче, стоячи — рівно на лінії.
        if (col === 0) expect(b.y1 + 1, `${name} ${row}: стопи`).toBe(FOOT_Y);
        else {
          expect(b.y1 + 1, `${name} ${row}/${col}: стопи`).toBeGreaterThanOrEqual(FOOT_Y - 2 * K);
          expect(b.y1 + 1, `${name} ${row}/${col}: стопи`).toBeLessThanOrEqual(FOOT_Y + K);
        }
      }
    }
  });

  it.each(Object.keys(FOLK))('folk/%s: зріст як у таблиці', (name) => {
    const b = boxOf(load(`folk/${name}`), 0);
    expect(b.y1 + 1 - b.y0).toBe(FOLK[name].height * K);
  });
});

describe('Піксель порту', () => {
  it.each([...MAIN, ...Object.keys(FOLK).map((n) => `folk/${n}`), ...LENA.flatMap((n) => [`${n}-mask`, `${n}-fall`, `${n}-fall-mask`, `${n}-poses`, `${n}-poses-mask`])])('%s: кожен піксель порту — однорідний квадрат K×K', (name) => {
    const img = load(name);
    for (let y = 0; y < img.height; y += K) {
      for (let x = 0; x < img.width; x += K) {
        const p = (y * img.width + x) * 4;
        for (let dy = 0; dy < K; dy += 1) {
          for (let dx = 0; dx < K; dx += 1) {
            const q = ((y + dy) * img.width + x + dx) * 4;
            for (let c = 0; c < 4; c += 1) if (img.data[p + c] !== img.data[q + c]) throw new Error(`${name}: квадрат у (${x}, ${y}) не однорідний`);
          }
        }
      }
    }
  });
});

describe('Маска одягу Лєни', () => {
  it.each(LENA)('%s: того самого розміру, лише на непрозорих пікселях, верх і низ у кожному кадрі, не на голові', (name) => {
    const img = load(name);
    const mask = load(`${name}-mask`);
    expect([mask.width, mask.height]).toEqual([img.width, img.height]);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const b = boxOf(img, col, row);
        let top = 0, bottom = 0;
        for (let y = 0; y < CELL; y += 1) {
          for (let x = 0; x < CELL; x += 1) {
            const X = col * CELL + x, Y = row * CELL + y;
            if (!alpha(mask, X, Y)) continue;
            expect(alpha(img, X, Y), `${name} ${row}/${col} (${x}, ${y}): маска на прозорому`).toBeGreaterThan(0);
            expect(y, `${name} ${row}/${col}: маска на голові`).toBeGreaterThanOrEqual(b.y0 + HEAD_ROWS);
            const [r, g] = rgb(mask, X, Y);
            if (r === 255) top += 1;
            if (g === 255) bottom += 1;
          }
        }
        // Зі спини (рядок 3) малої верх майже весь під кучерями — там хоч піксель.
        expect(top, `${name} ${row}/${col}: верх`).toBeGreaterThan(row === 3 ? 0 : 5 * K * K);
        expect(bottom, `${name} ${row}/${col}: низ`).toBeGreaterThan(4 * K * K);
      }
    }
  });
});

describe('Падіння Лєни', () => {
  const FRAMES = FALL_DOWN_FRAMES + FALL_UP_FRAMES;

  it.each(LENA)('%s: кадри на лінії стоп, лежача вміщається, підвівшись — як на аркуші ходи «праворуч»', (name) => {
    const strip = load(`${name}-fall`);
    const mask = load(`${name}-fall-mask`);
    expect([strip.width, strip.height]).toEqual([CELL * FRAMES, CELL]);
    expect([mask.width, mask.height]).toEqual([strip.width, strip.height]);
    for (let f = 0; f < FRAMES; f += 1) {
      const b = boxOf(strip, f);
      expect(b, `${name} кадр ${f}`).not.toBeNull();
      expect(b.y1 + 1, `${name} кадр ${f}: на землі`).toBe(FOOT_Y);
      // Не обрізано краєм клітинки.
      expect(b.x0, `${name} кадр ${f}`).toBeGreaterThan(0);
      expect(b.x1, `${name} кадр ${f}`).toBeLessThan(CELL - 1);
    }
    const lying = boxOf(strip, FALL_DOWN_FRAMES - 1);
    expect(lying.x1 - lying.x0, `${name}: лежить`).toBeGreaterThan((lying.y1 - lying.y0) * 1.5);
    // Підвівшись — той самий кадр, що «стоїть, праворуч» на аркуші.
    const sheet = load(name);
    for (let y = 0; y < CELL; y += 1) {
      for (let x = 0; x < CELL; x += 1) {
        expect(alpha(strip, (FRAMES - 1) * CELL + x, y) > 0, `${name} (${x}, ${y})`).toBe(alpha(sheet, x, 2 * CELL + y) > 0);
      }
    }
  });
});

describe('Пози Лєни й долоні', () => {
  it.each(LENA)('%s: у кожній позі в точці долоні — шкіра, обличчям до нас — теж', (name) => {
    const strip = load(`${name}-poses`);
    expect([strip.width, strip.height]).toEqual([CELL * POSE_NAMES.length, CELL]);
    const near = (img, cx, cy, col, row, reach = 2 * K) => {
      for (let dy = -reach; dy <= reach; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const x = Math.round(cx + dx), y = Math.round(cy + dy);
          if (x < 0 || y < 0 || x >= CELL || y >= CELL) continue;
          const X = col * CELL + x, Y = row * CELL + y;
          if (alpha(img, X, Y) && isSkin(rgb(img, X, Y))) return true;
        }
      }
      return false;
    };
    POSE_NAMES.forEach((pose, k) => {
      const h = PORT[name].hands[pose];
      expect(near(strip, FOOT_X + h.x, FOOT_Y - 1 - h.y, k, 0), `${name} ${pose}`).toBe(true);
    });
    const front = PORT[name].front;
    const sheet = load(name);
    // Висота — середня для обох рук (руки висять не завжди на одній), тож допуск ширший.
    expect(near(sheet, FOOT_X + front.l, FOOT_Y - 1 - front.up, 0, 0, 3 * K), `${name}: ліва долоня`).toBe(true);
    expect(near(sheet, FOOT_X + front.r, FOOT_Y - 1 - front.up, 0, 0, 3 * K), `${name}: права долоня`).toBe(true);
  });
});
