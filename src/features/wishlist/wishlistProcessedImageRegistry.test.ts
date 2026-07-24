import { describe, expect, it } from 'vitest';
import {
  clearWishlistStoredVisual,
  registerWishlistProcessedRows,
  updateWishlistStoredVisual,
  wishlistRegisteredImage,
  wishlistStoredVisual,
} from './wishlistProcessedImageRegistry';

const DEFAULTS = {
  image_preference: 'auto' as const,
  image_processing_revision: 0,
  image_processing_status: 'ready' as const,
  image_processor_version: 1,
  image_processing_target_version: null,
  image_processing_attempts: 1,
  image_processing_error_code: null,
  image_processing_lease_expires_at: null,
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
    expect(wishlistRegisteredImage(101, source)?.processingStatus).toBe('ready');
    expect(wishlistRegisteredImage(101, source)?.processorVersion).toBe(1);
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
        ...DEFAULTS,
        id: 103,
        image_url: source,
        processed_image_url: null,
        image_mode: 'photo-cover',
        image_preference: 'photo-cover',
        image_processing_revision: 1,
      },
      {
        ...DEFAULTS,
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
      image_processing_status: 'pending',
      image_processor_version: 0,
    }]);

    updateWishlistStoredVisual(source, 105, {
      src: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/processed/105/c.webp',
      mode: 'product-cutout',
    });
    expect(wishlistStoredVisual(105, source)?.mode).toBe('product-cutout');
    expect(wishlistRegisteredImage(105, source)?.processingStatus).toBe('ready');

    clearWishlistStoredVisual(105, source, 'portrait-cutout', 3);
    expect(wishlistStoredVisual(105, source)).toBeNull();
    expect(wishlistRegisteredImage(105, source)).toMatchObject({
      preference: 'portrait-cutout',
      revision: 3,
      processingStatus: 'pending',
      processorVersion: 0,
      processingAttempts: 0,
    });
  });
});
