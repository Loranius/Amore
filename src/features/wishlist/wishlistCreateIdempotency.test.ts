import { describe, expect, it } from 'vitest';
import {
  WishlistCreateRequestTracker,
  wishlistCreateRequestKey,
  type WishlistCreateRequestInput,
} from './wishlistCreateIdempotency';

const baseInput: WishlistCreateRequestInput = {
  ownerId: 1,
  shared: false,
  payload: {
    title: 'Мрія',
    description: null,
    link: null,
    image_url: null,
    image_preference: 'auto',
    price: null,
    priority: 'medium',
  },
};

describe('Wishlist create idempotency', () => {
  it('normalizes retry uploads from wishlist-photos', () => {
    const first = {
      ...baseInput,
      payload: {
        ...baseInput.payload,
        image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/1/first.webp',
      },
    };
    const retry = {
      ...baseInput,
      payload: {
        ...baseInput.payload,
        image_url: 'https://project.supabase.co/storage/v1/object/public/wishlist-photos/1/retry.webp',
      },
    };

    expect(wishlistCreateRequestKey(retry)).toBe(wishlistCreateRequestKey(first));
  });

  it('keeps remote image URLs distinct', () => {
    const first = {
      ...baseInput,
      payload: { ...baseInput.payload, image_url: 'https://example.com/a.webp' },
    };
    const second = {
      ...baseInput,
      payload: { ...baseInput.payload, image_url: 'https://example.com/b.webp' },
    };

    expect(wishlistCreateRequestKey(second)).not.toBe(wishlistCreateRequestKey(first));
  });

  it('keeps the same domain create request when only presentation preference changes', () => {
    const first = {
      ...baseInput,
      payload: {
        ...baseInput.payload,
        image_url: 'https://example.com/item.webp',
        image_preference: 'auto' as const,
      },
    };
    const retry = {
      ...first,
      payload: { ...first.payload, image_preference: 'portrait-cutout' as const },
    };

    expect(wishlistCreateRequestKey(retry)).toBe(wishlistCreateRequestKey(first));
  });

  it('reuses a request id until the command settles', () => {
    let counter = 0;
    const tracker = new WishlistCreateRequestTracker(() => `request-${++counter}`);

    const first = tracker.acquire(baseInput);
    const retry = tracker.acquire(baseInput);
    expect(retry.requestId).toBe(first.requestId);

    tracker.release(first.key);
    expect(tracker.acquire(baseInput).requestId).not.toBe(first.requestId);
  });

  it('rotates a stale request id after the retry window', () => {
    let counter = 0;
    let now = 1_000;
    const tracker = new WishlistCreateRequestTracker(
      () => `request-${++counter}`,
      () => now,
      500,
    );

    const first = tracker.acquire(baseInput);
    now += 501;
    expect(tracker.acquire(baseInput).requestId).not.toBe(first.requestId);
  });
});
