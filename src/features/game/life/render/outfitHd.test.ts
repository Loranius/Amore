import { describe, expect, it } from 'vitest';
import { recolorOutfit, type Garment } from './outfitHd';

// ADR-0239: куплений одяг видно і в 32×32 — аркуш PixelLab перефарбовується
// там, де одяг, і ніде більше; світлотінь лишається.

type Rgb = [number, number, number];
const CELL = 20;

/**
 * Аркуш із кадрів 20×20; у кожному кадрі людина — лівий стовпець, стопи —
 * останній рядок клітинки.
 */
function sheet(frames: Rgb[][]): Uint8ClampedArray {
  const width = CELL * frames.length;
  const d = new Uint8ClampedArray(width * CELL * 4);
  frames.forEach((rows, f) => {
    const top = CELL - rows.length;
    rows.forEach(([r, g, b], k) => d.set([r, g, b, 255], ((top + k) * width + f * CELL) * 4));
  });
  return d;
}
/** RGBA пікселя людини в кадрі `f`, `fromFeet` рядків над стопами (0 — стопи). */
function at(d: Uint8ClampedArray, frames: number, f: number, fromFeet: number): number[] {
  const i = ((CELL - 1 - fromFeet) * CELL * frames + f * CELL) * 4;
  return [...d.slice(i, i + 4)];
}

const WHITE: Rgb = [250, 250, 250];
const SHADE: Rgb = [175, 175, 175];
const LILAC: Rgb = [178, 176, 196];
const TRIM: Rgb = [99, 161, 206];
const NAVY: Rgb = [40, 50, 100];
const SKIN: Rgb = [240, 200, 170];
const HAIR: Rgb = [120, 70, 40];

const CLOTHES: Garment[] = [
  { part: 'top', band: [0.36, 0.68], tones: [{ maxS: 0.1, minV: 0.4 }, { hue: [0.55, 0.8], maxS: 0.3, minV: 0.45 }] },
  { part: 'accent', band: [0.36, 0.56], tones: [{ hue: [0.5, 0.64], minS: 0.3, minV: 0.4 }] },
  { part: 'bottom', band: [0.56, 1.01], tones: [{ hue: [0.58, 0.78], minS: 0.3, maxV: 0.65 }] },
];

// Згори вниз (у дужках — рядків над стопами): волосся (12, 11), білок ока
// (10) — білий, але вище футболки, шкіра (9, 8), комір (7), футболка (6),
// її тінь (5), бузкова тінь (4), рука (3), джинси (2–0). Зріст — 12.
const STANDING: Rgb[] = [HAIR, HAIR, WHITE, SKIN, SKIN, TRIM, WHITE, SHADE, LILAC, SKIN, NAVY, NAVY, NAVY];
// Те саме збоку: хвіст стирчить на чотири рядки вище маківки.
const SIDEWAYS: Rgb[] = [HAIR, HAIR, HAIR, HAIR, ...STANDING];

describe('Перевдягання аркуша 32×32', () => {
  it('фарбує футболку в колір речі й лишає тінь темнішою за світло', () => {
    const d = sheet([STANDING]);
    recolorOutfit(d, CELL, CELL, CELL, CLOTHES, { top: '#c2494f' });
    const lit = at(d, 1, 0, 6);
    const shade = at(d, 1, 0, 5);
    expect(lit[0]).toBeGreaterThan(lit[1]! + 60); // червоне
    expect(shade[0]).toBeLessThan(lit[0]!); // тінь лишилась
    expect(shade[0]).toBeGreaterThan(shade[1]!);
  });

  it('фарбує й бузкову тінь футболки — у кадрах збоку її найбільше', () => {
    const d = sheet([STANDING]);
    recolorOutfit(d, CELL, CELL, CELL, CLOTHES, { top: '#c2494f' });
    const [r, g, b] = at(d, 1, 0, 4);
    expect(r).toBeGreaterThan(g! + 40);
    expect(r).toBeGreaterThan(b! + 40);
  });

  it('не чіпає волосся, білок ока, шкіру й частини без нового кольору', () => {
    const d = sheet([STANDING]);
    const before = sheet([STANDING]);
    recolorOutfit(d, CELL, CELL, CELL, CLOTHES, { top: '#c2494f' });
    for (const y of [0, 1, 2, 3, 7, 8, 9, 10, 11, 12]) expect(at(d, 1, 0, y)).toEqual(at(before, 1, 0, y));
  });

  it('фарбує джинси, коли змінився низ, а комір — у колір оздоблення', () => {
    const d = sheet([STANDING]);
    recolorOutfit(d, CELL, CELL, CELL, CLOTHES, { bottom: '#7a4a2a', accent: '#b8323a' });
    const [r, g, b] = at(d, 1, 0, 1);
    expect(r).toBeGreaterThan(b!);
    expect(g).toBeGreaterThan(b!);
    const [ar, , ab] = at(d, 1, 0, 7);
    expect(ar).toBeGreaterThan(ab! + 60);
  });

  // Регресія: смуги рахувались від маківки, і в кадрах збоку, де хвіст
  // стирчить вище голови, усе з'їжджало вниз — футболка зі смуги, а білок
  // ока в смугу футболки.
  it('рахує смуги від стоп: хвіст над головою не зсуває одяг', () => {
    const d = sheet([STANDING, SIDEWAYS]);
    const before = sheet([STANDING, SIDEWAYS]);
    recolorOutfit(d, CELL * 2, CELL, CELL, CLOTHES, { top: '#c2494f' });
    for (const y of [4, 5, 6]) {
      expect(at(d, 2, 1, y)).toEqual(at(d, 2, 0, y));
      expect(at(d, 2, 1, y)).not.toEqual(at(before, 2, 1, y));
    }
    expect(at(d, 2, 1, 10)).toEqual(at(before, 2, 1, 10)); // білок ока — свій
  });

  it('однакові вхідні дані дають однаковий аркуш', () => {
    const a = sheet([STANDING, SIDEWAYS]);
    const b = sheet([STANDING, SIDEWAYS]);
    const colors = { top: '#3b3f58', bottom: '#2c2f45', accent: '#f4f4f7' };
    recolorOutfit(a, CELL * 2, CELL, CELL, CLOTHES, colors);
    recolorOutfit(b, CELL * 2, CELL, CELL, CLOTHES, colors);
    expect([...a]).toEqual([...b]);
  });
});
