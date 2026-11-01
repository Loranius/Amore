// Модульні люди (ADR-0239, поправка 2026-11-01 «Модульні люди, етап 1»): один
// скелет на всіх, шари в однакових координатах, аркуші PNG без напівпрозорості.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DOLLS, DIMA_DOLL, LENA_DOLL } from './dolls';
import { BASE_LAYERS, CELL, DOLL_DIRS, FOOT, renderLayer, type LayerName } from './rig';
import { layerSheet } from './sheet';

/** Силует шару: `#` там, де щось намальовано. */
function mask(rows: readonly string[]): string[] {
  return rows.map((r) => r.replace(/[^.]/g, '#'));
}

function stack(face: 'girl' | 'boy', dir: 0 | 1 | 2 | 3, layers: readonly LayerName[]): string[] {
  const out = Array.from({ length: CELL.h }, () => Array<string>(CELL.w).fill('.'));
  for (const l of layers) {
    renderLayer(l, dir, face).forEach((r, y) => [...r].forEach((k, x) => { if (k !== '.') out[y]![x] = k; }));
  }
  return out.map((r) => r.join(''));
}

describe('модульні люди: один скелет', () => {
  it('тіло, голова й очі Лєни та Діми однакові за формою в кожному напрямі', () => {
    for (const dir of DOLL_DIRS) {
      for (const layer of ['body', 'head', 'eyes'] as const) {
        expect(renderLayer(layer, dir, 'girl'), `${layer} ${dir}`).toEqual(renderLayer(layer, dir, 'boy'));
      }
    }
  });

  it('обличчя різняться лише накладкою: брови, рот, рум\'янець', () => {
    expect(renderLayer('face', 0, 'girl')).not.toEqual(renderLayer('face', 0, 'boy'));
    expect(renderLayer('face', 3, 'girl').join('')).toMatch(/^\.+$/);
  });

  it('«ліворуч» — дзеркало «праворуч» у кожному шарі', () => {
    for (const layer of BASE_LAYERS) {
      const right = renderLayer(layer, 2, 'girl');
      expect(renderLayer(layer, 1, 'girl')).toEqual(right.map((r) => [...r].reverse().join('')));
    }
  });

  it('спереду й ззаду силует симетричний', () => {
    for (const dir of [0, 3] as const) {
      const m = mask(stack('girl', dir, ['body', 'head']));
      expect(m).toEqual(m.map((r) => [...r].reverse().join('')));
    }
  });

  it('стоїть на точці між стопами, зріст 42–46 пікселів малюнка (спрайт власника — 44), в усіх напрямах однаковий', () => {
    for (const dir of DOLL_DIRS) {
      const rows = mask(stack('girl', dir, ['body', 'head']));
      const filled = rows.map((r, y) => (r.includes('#') ? y : -1)).filter((y) => y >= 0);
      const top = filled[0]!;
      const bottom = filled[filled.length - 1]!;
      expect(bottom, `низ, напрям ${dir}`).toBe(FOOT.y - 1);
      expect(bottom - top + 1).toBeGreaterThanOrEqual(42);
      expect(bottom - top + 1).toBeLessThanOrEqual(46);
      // Стопи — по обидва боки від осі (x 15 | 16), а не зсунуті вбік.
      const feet = rows[bottom]!;
      expect(feet.indexOf('#')).toBeLessThan(FOOT.x);
      expect(feet.lastIndexOf('#')).toBeGreaterThanOrEqual(FOOT.x - 1);
    }
  });

  it('очі там, де голова, і не виходять за неї', () => {
    for (const dir of [0, 2] as const) {
      const head = mask(renderLayer('head', dir, 'girl'));
      renderLayer('eyes', dir, 'girl').forEach((r, y) => [...r].forEach((k, x) => {
        if (k !== '.') expect(head[y]![x], `око (${x}, ${y})`).toBe('#');
      }));
    }
  });
});

describe('аркуші шарів', () => {
  it('лише повна прозорість або повна непрозорість — нічого не змішається при масштабуванні', () => {
    for (const d of DOLLS) {
      for (const layer of BASE_LAYERS) {
        const s = layerSheet(d, layer);
        expect(s.width).toBe(CELL.w);
        expect(s.height).toBe(CELL.h * 4);
        for (let i = 3; i < s.data.length; i += 4) expect([0, 255]).toContain(s.data[i]);
      }
    }
  });

  it('кольори різні: очі Лєни карі, Діми сіро-блакитні; шкіра однакова', () => {
    const eye = (d: typeof LENA_DOLL): number[] => {
      const s = layerSheet(d, 'eyes');
      const rows = renderLayer('eyes', 0, d.face);
      const y = rows.findIndex((r) => r.includes('e'));
      const i = (y * CELL.w + rows[y]!.indexOf('e')) * 4;
      return [s.data[i]!, s.data[i + 1]!, s.data[i + 2]!];
    };
    expect(eye(LENA_DOLL)).not.toEqual(eye(DIMA_DOLL));
    expect(layerSheet(LENA_DOLL, 'body').data).toEqual(layerSheet(DIMA_DOLL, 'body').data);
  });

  it('PNG у assets/doll збігаються з кодом (`node scripts/doll/export.mjs`)', () => {
    for (const d of DOLLS) {
      for (const layer of BASE_LAYERS) {
        const file = new URL(`../assets/doll/${d.name}-${layer}.png`, import.meta.url);
        expect(decodePng(readFileSync(file)), `${d.name}-${layer}.png застарів`).toEqual(layerSheet(d, layer));
      }
    }
  });
});

/** Читач PNG, які пише `scripts/doll/export.mjs`: RGBA 8 біт, фільтр 0. */
function decodePng(buf: Buffer): { width: number; height: number; data: Uint8ClampedArray } {
  let p = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 6) throw new Error('очікувався RGBA 8 біт');
    }
    if (type === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    if (raw[y * (width * 4 + 1)] !== 0) throw new Error('очікувався фільтр 0');
    data.set(raw.subarray(y * (width * 4 + 1) + 1, (y + 1) * (width * 4 + 1)), y * width * 4);
  }
  return { width, height, data };
}
