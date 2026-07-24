import { describe, expect, it } from 'vitest';
import {
  inferWishlistImageDisplayMode,
  isWishlistTransparentDisplayMode,
} from './wishlistImageModes';

describe('wishlist image presentation modes', () => {
  it('uses photo-cover for an unprocessed ordinary photo', () => {
    expect(inferWishlistImageDisplayMode('https://shop.example/photo.jpg', 'cover'))
      .toBe('photo-cover');
  });

  it('maps the current uniform-background cutout to product-cutout', () => {
    expect(inferWishlistImageDisplayMode('data:image/webp;base64,abc', 'cutout'))
      .toBe('product-cutout');
  });

  it('recognises the future portrait cutout asset marker', () => {
    expect(inferWishlistImageDisplayMode(
      'https://cdn.example/wish-portrait-cutout-42.webp',
      'cover',
    )).toBe('portrait-cutout');
  });

  it('lets an explicit display hint override automatic inference', () => {
    expect(inferWishlistImageDisplayMode(
      'https://shop.example/photo.jpg',
      'cover',
      'portrait-cutout',
    )).toBe('portrait-cutout');
  });

  it('reports only cutout modes as transparent', () => {
    expect(isWishlistTransparentDisplayMode('product-cutout')).toBe(true);
    expect(isWishlistTransparentDisplayMode('portrait-cutout')).toBe(true);
    expect(isWishlistTransparentDisplayMode('photo-cover')).toBe(false);
  });
});
