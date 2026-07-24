import { describe, expect, it } from 'vitest';
import {
  registerWishlistProcessedRows,
  updateWishlistStoredVisual,
  wishlistIdsForImageSource,
  wishlistStoredVisual,
} from './wishlistProcessedImageRegistry';

describe('wishlist processed image registry', () => {
  it('returns a persisted transparent visual and registered wish id', () => {
    const source = 'https://shop.example/registry-product-a.jpg';
    registerWishlistProcessedRows([{
      id: 101,
      image_url: source,
      processed_image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/wish-101.webp',
      image_mode: 'product-cutout',
    }]);

    expect(wishlistStoredVisual(source)).toEqual({
      src: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/wish-101.webp',
      mode: 'product-cutout',
    });
    expect(wishlistIdsForImageSource(source)).toContain(101);
  });

  it('uses photo-cover without a duplicate processed asset', () => {
    const source = 'https://shop.example/registry-cover-b.jpg';
    registerWishlistProcessedRows([{
      id: 102,
      image_url: source,
      processed_image_url: null,
      image_mode: 'photo-cover',
    }]);

    expect(wishlistStoredVisual(source)).toEqual({ src: source, mode: 'photo-cover' });
  });

  it('prefers a transparent visual when the same source belongs to several wishes', () => {
    const source = 'https://shop.example/registry-shared-c.jpg';
    registerWishlistProcessedRows([
      {
        id: 103,
        image_url: source,
        processed_image_url: null,
        image_mode: 'photo-cover',
      },
      {
        id: 104,
        image_url: source,
        processed_image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/wish-104.webp',
        image_mode: 'portrait-cutout',
      },
    ]);

    expect(wishlistStoredVisual(source)?.mode).toBe('portrait-cutout');
  });

  it('updates the local cache after a successful persistence command', () => {
    const source = 'https://shop.example/registry-update-d.jpg';
    registerWishlistProcessedRows([{
      id: 105,
      image_url: source,
      processed_image_url: null,
      image_mode: null,
    }]);

    updateWishlistStoredVisual(source, 105, {
      src: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/wish-105.webp',
      mode: 'product-cutout',
    });

    expect(wishlistStoredVisual(source)?.mode).toBe('product-cutout');
  });
});
