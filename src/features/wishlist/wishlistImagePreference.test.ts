import { describe, expect, it } from 'vitest';
import {
  normalizeWishlistImagePreference,
  wishlistImageProcessingSteps,
  wishlistResultMatchesPreference,
} from './wishlistImagePreference';

describe('Wishlist image preference', () => {
  it('falls back to auto for unknown values', () => {
    expect(normalizeWishlistImagePreference(null)).toBe('auto');
    expect(normalizeWishlistImagePreference('legacy')).toBe('auto');
  });

  it('maps each preference to an explicit processing pipeline', () => {
    expect(wishlistImageProcessingSteps('auto')).toEqual(['product', 'portrait']);
    expect(wishlistImageProcessingSteps('product-cutout')).toEqual(['product']);
    expect(wishlistImageProcessingSteps('portrait-cutout')).toEqual(['portrait']);
    expect(wishlistImageProcessingSteps('photo-cover')).toEqual([]);
  });

  it('allows a safe photo fallback when a requested cutout is unusable', () => {
    expect(wishlistResultMatchesPreference('product-cutout', 'product-cutout')).toBe(true);
    expect(wishlistResultMatchesPreference('product-cutout', 'photo-cover')).toBe(true);
    expect(wishlistResultMatchesPreference('product-cutout', 'portrait-cutout')).toBe(false);

    expect(wishlistResultMatchesPreference('portrait-cutout', 'portrait-cutout')).toBe(true);
    expect(wishlistResultMatchesPreference('portrait-cutout', 'photo-cover')).toBe(true);
    expect(wishlistResultMatchesPreference('portrait-cutout', 'product-cutout')).toBe(false);
  });

  it('keeps original-photo mode strict', () => {
    expect(wishlistResultMatchesPreference('photo-cover', 'photo-cover')).toBe(true);
    expect(wishlistResultMatchesPreference('photo-cover', 'product-cutout')).toBe(false);
  });
});
