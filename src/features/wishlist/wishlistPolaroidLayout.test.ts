import { describe, expect, it } from 'vitest';
import { wishlistPolaroidLayout } from './wishlistPolaroidLayout';

describe('wishlistPolaroidLayout', () => {
  it('is stable for one seed, wish and index', () => {
    expect(wishlistPolaroidLayout(42, 17, 0)).toEqual(
      wishlistPolaroidLayout(42, 17, 0),
    );
  });

  it('keeps placement inside the intended visual ranges', () => {
    for (let index = 0; index < 40; index += 1) {
      const placement = wishlistPolaroidLayout(991, index + 1, index);
      expect([-4, 4]).toContain(placement.rotate);
      expect(Math.abs(placement.x)).toBeGreaterThanOrEqual(10);
      expect(Math.abs(placement.x)).toBeLessThanOrEqual(28);
      expect(placement.y).toBeGreaterThanOrEqual(-8);
      expect(placement.y).toBeLessThanOrEqual(8);
      expect(placement.tapeRotate).toBeGreaterThanOrEqual(-3);
      expect(placement.tapeRotate).toBeLessThanOrEqual(3);
    }
  });

  it('changes the arrangement when the seed changes', () => {
    expect(wishlistPolaroidLayout(1, 17, 0)).not.toEqual(
      wishlistPolaroidLayout(2, 17, 0),
    );
  });
});
