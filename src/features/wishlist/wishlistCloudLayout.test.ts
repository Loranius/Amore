import { describe, expect, it } from 'vitest';
import {
  normalizeWishlistCloudPriority,
  wishlistCloudPlacement,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';

describe('wishlist cloud priority presentation', () => {
  it.each([
    ['high', 'Жадане', 174],
    ['dream', 'Жадане', 174],
    ['medium', 'Бажане', 116],
    ['low', 'Приємне', 78],
  ] as const)('maps %s to %s with a %spx bubble', (priority, label, size) => {
    expect(wishlistCloudPriorityPresentation(priority)).toMatchObject({ label, size });
  });

  it('uses medium priority for legacy items without a value', () => {
    expect(normalizeWishlistCloudPriority(null)).toBe('medium');
  });
});

describe('wishlist cloud placement', () => {
  it('is stable for the same wish and position', () => {
    expect(wishlistCloudPlacement(42, 3)).toEqual(wishlistCloudPlacement(42, 3));
  });

  it('varies between wishes without changing bubble size', () => {
    expect(wishlistCloudPlacement(42, 3)).not.toEqual(wishlistCloudPlacement(43, 3));
  });
});
