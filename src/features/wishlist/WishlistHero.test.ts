import { describe, expect, it } from 'vitest';
import { activeWishlistLabel } from './WishlistHero';

describe('activeWishlistLabel', () => {
  it.each([
    [0, 'активних бажань'],
    [1, 'активне бажання'],
    [2, 'активні бажання'],
    [4, 'активні бажання'],
    [5, 'активних бажань'],
    [11, 'активних бажань'],
    [14, 'активних бажань'],
    [21, 'активне бажання'],
    [22, 'активні бажання'],
  ])('formats %s correctly', (count, expected) => {
    expect(activeWishlistLabel(count)).toBe(expected);
  });
});
