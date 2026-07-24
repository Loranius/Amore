import { describe, expect, it } from 'vitest';
import {
  clearWishlistStoredVisual,
  registerWishlistProcessedRows,
  updateWishlistStoredVisual,
  wishlistStoredVisual,
} from './wishlistProcessedImageRegistry';

const DEFAULTS = {
  image_preference: 'auto' as const,
  image_processing_revision: 0,
};

describe('wishlist processed image registry', () => {
  it('returns a persisted transparent visual for the exact wish', () => {
    const source = 'https://shop.example/registry-product-a.jpg';
    registerWishlistProcessedRows([{
      id: 101,
      image_url: source,
      processed_image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/101/a.webp',
      image_mode: 'product-cutout',
      ...DEFAULTS,
    }]);

    expect(wishlistStoredVisual(101, source)).toEqual({
      src: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/101/a.webp',
      mode: 'product-cutout',
    });
    expect(wishlistStoredVisual(999, source)).toBeNull();
  });

  it('uses photo-cover without a duplicate processed asset', () => {
    const source = 'https://shop.example/registry-cover-b.jpg';
    registerWishlistProcessedRows([{
      id: 102,
      image_url: source,
      processed_image_url: null,
      image_mode: 'photo-cover',
      ...DEFAULTS,
    }]);

    expect(wishlistStoredVisual(102, source)).toEqual({ src: source, mode: 'photo-cover' });
  });

  it('keeps different preferences separate for identical source URLs', () => {
    const source = 'https://shop.example/registry-shared-c.jpg';
    registerWishlistProcessedRows([
      {
        id: 103,
        image_url: source,
        processed_image_url: null,
        image_mode: 'photo-cover',
        image_preference: 'photo-cover',
        image_processing_revision: 1,
      },
      {
        id: 104,
        image_url: source,
        processed_image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/104/b.webp',
        image_mode: 'portrait-cutout',
        image_preference: 'portrait-cutout',
        image_processing_revision: 2,
      },
    ]);

    expect(wishlistStoredVisual(103, source)?.mode).toBe('photo-cover');
    expect(wishlistStoredVisual(104, source)?.mode).toBe('portrait-cutout');
  });

  it('updates and clears the exact local cache record', () => {
    const source = 'https://shop.example/registry-update-d.jpg';
    registerWishlistProcessedRows([{
      id: 105,
      image_url: source,
      processed_image_url: null,
      image_mode: null,
      ...DEFAULTS,
    }]);

    updateWishlistStoredVisual(source, 105, {
      src: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/105/c.webp',
      mode: 'product-cutout',
    });
    expect(wishlistStoredVisual(105, source)?.mode).toBe('product-cutout');

    clearWishlistStoredVisual(105, source, 'portrait-cutout', 3);
    expect(wishlistStoredVisual(105, source)).toBeNull();
  });
});
