import { describe, expect, it } from 'vitest';
import { portraitMaskLooksUsable } from './wishlistPortraitMask';

function mask(size: number, foregroundCount: number, value = 0.9): Float32Array {
  const values = new Float32Array(size);
  for (let index = 0; index < foregroundCount; index += 1) values[index] = value;
  return values;
}

describe('portraitMaskLooksUsable', () => {
  it('rejects an empty mask', () => {
    expect(portraitMaskLooksUsable(new Float32Array())).toBe(false);
  });

  it('rejects a tiny accidental foreground region', () => {
    expect(portraitMaskLooksUsable(mask(1000, 30))).toBe(false);
  });

  it('rejects a mask that covers nearly the whole image', () => {
    expect(portraitMaskLooksUsable(mask(1000, 960))).toBe(false);
  });

  it('accepts a confident person-shaped foreground ratio', () => {
    expect(portraitMaskLooksUsable(mask(1000, 420))).toBe(true);
  });

  it('rejects low-confidence foreground noise', () => {
    expect(portraitMaskLooksUsable(mask(1000, 420, 0.4))).toBe(false);
  });
});
