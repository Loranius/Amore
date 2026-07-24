import { describe, expect, it } from 'vitest';
import {
  CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
  wishlistImageProcessingErrorCode,
  wishlistImageResultFresh,
  wishlistImageResultUsable,
  wishlistImageRetryDelayMs,
} from './wishlistImageProcessingState';

describe('Wishlist image processing state', () => {
  it('accepts compatible persisted visuals', () => {
    expect(wishlistImageResultUsable({
      preference: 'product-cutout',
      mode: 'product-cutout',
      processedSrc: 'https://example.com/product.webp',
    })).toBe(true);

    expect(wishlistImageResultUsable({
      preference: 'photo-cover',
      mode: 'photo-cover',
      processedSrc: null,
    })).toBe(true);
  });

  it('rejects incompatible or incomplete persisted visuals', () => {
    expect(wishlistImageResultUsable({
      preference: 'portrait-cutout',
      mode: 'product-cutout',
      processedSrc: 'https://example.com/product.webp',
    })).toBe(false);

    expect(wishlistImageResultUsable({
      preference: 'product-cutout',
      mode: 'product-cutout',
      processedSrc: null,
    })).toBe(false);
  });

  it('requires a ready result from the current processor version', () => {
    expect(wishlistImageResultFresh({
      status: 'ready',
      processorVersion: CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
      preference: 'auto',
      mode: 'portrait-cutout',
      processedSrc: 'https://example.com/person.webp',
    })).toBe(true);

    expect(wishlistImageResultFresh({
      status: 'failed',
      processorVersion: CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION,
      preference: 'auto',
      mode: 'portrait-cutout',
      processedSrc: 'https://example.com/person.webp',
    })).toBe(false);

    expect(wishlistImageResultFresh({
      status: 'ready',
      processorVersion: CURRENT_WISHLIST_IMAGE_PROCESSOR_VERSION - 1,
      preference: 'auto',
      mode: 'portrait-cutout',
      processedSrc: 'https://example.com/person.webp',
    })).toBe(false);
  });

  it('bounds lease retry delays', () => {
    expect(wishlistImageRetryDelayMs(null)).toBeNull();
    expect(wishlistImageRetryDelayMs(1)).toBe(750);
    expect(wishlistImageRetryDelayMs(2_500)).toBe(2_500);
    expect(wishlistImageRetryDelayMs(999_999)).toBe(120_000);
  });

  it('maps internal failures to non-sensitive error codes', () => {
    expect(wishlistImageProcessingErrorCode(new Error('portrait segment model failed')))
      .toBe('portrait_segmentation_failed');
    expect(wishlistImageProcessingErrorCode(new Error('storage upload rejected')))
      .toBe('storage_upload_failed');
    expect(wishlistImageProcessingErrorCode(new Error('unexpected details')))
      .toBe('image_processing_failed');
  });
});
