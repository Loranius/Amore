import { describe, expect, it } from 'vitest';
import { maskParts, maskReference, recolorByMask } from './outfitHd';

// ADR-0239: куплений одяг видно на аркуші — перефарбовується там, де маска
// каже «одяг», і ніде більше; світлотінь лишається.

type Rgba = [number, number, number, number];
const TOP: Rgba = [255, 0, 0, 255];
const BOTTOM: Rgba = [0, 255, 0, 255];
const NONE: Rgba = [0, 0, 0, 0];

function img(px: Rgba[]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(px.length * 4);
  px.forEach((p, i) => d.set(p, i * 4));
  return d;
}
const pixel = (d: Uint8ClampedArray, i: number) => [...d.slice(i * 4, i * 4 + 4)];

// Пікселі: світлий верх, тінь верху, низ, шкіра, прозорий.
const SHEET: Rgba[] = [[200, 120, 90, 255], [100, 60, 45, 255], [50, 70, 110, 255], [240, 190, 140, 255], [0, 0, 0, 0]];
const MASK: Rgba[] = [TOP, TOP, BOTTOM, NONE, TOP];

describe('Перевдягання за маскою', () => {
  it('частини — за каналами маски, решта — нічия', () => {
    expect([...maskParts(img(MASK))]).toEqual([0, 0, 1, -1, 0]);
  });

  it('фарбує лише верх, шкіру й прозоре не чіпає', () => {
    const d = img(SHEET);
    recolorByMask(d, img(MASK), { top: '#2e8b57' });
    expect(pixel(d, 2)).toEqual([50, 70, 110, 255]);
    expect(pixel(d, 3)).toEqual([240, 190, 140, 255]);
    expect(pixel(d, 4)).toEqual([0, 0, 0, 0]);
    // Зелений верх: зеленого більше за червоний і синій.
    const [r, g, b] = pixel(d, 0) as [number, number, number];
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('світлотінь лишається: тінь верху темніша за світло в тій самій пропорції', () => {
    const d = img(SHEET);
    const ref = maskReference(d, img(MASK));
    recolorByMask(d, img(MASK), { top: '#2e8b57' }, ref);
    const light = Math.max(...pixel(d, 0).slice(0, 3));
    const shade = Math.max(...pixel(d, 1).slice(0, 3));
    expect(shade / light).toBeCloseTo(100 / 200, 1);
  });

  it('без кольору частину не чіпає', () => {
    const d = img(SHEET);
    recolorByMask(d, img(MASK), { bottom: undefined });
    expect([...d]).toEqual([...img(SHEET)]);
  });

  it('маска не того розміру — помилка, а не мовчки', () => {
    expect(() => recolorByMask(img(SHEET), img(MASK.slice(1)), { top: '#ffffff' })).toThrow(/маска/);
  });
});
