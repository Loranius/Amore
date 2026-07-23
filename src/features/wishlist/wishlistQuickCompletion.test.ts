import { describe, expect, it } from 'vitest';
import { WishlistQuickCompletionTracker } from './wishlistQuickCompletion';

describe('WishlistQuickCompletionTracker', () => {
  it('reuses one idempotency key for retries of the same wish', () => {
    let sequence = 0;
    const tracker = new WishlistQuickCompletionTracker(() => `key-${++sequence}`, () => 1_000);

    expect(tracker.acquire(10)).toBe('key-1');
    expect(tracker.acquire(10)).toBe('key-1');
    expect(tracker.acquire(11)).toBe('key-2');
  });

  it('creates a fresh key after release or expiry', () => {
    let sequence = 0;
    let now = 1_000;
    const tracker = new WishlistQuickCompletionTracker(
      () => `key-${++sequence}`,
      () => now,
      500,
    );

    expect(tracker.acquire(10)).toBe('key-1');
    tracker.release(10);
    expect(tracker.acquire(10)).toBe('key-2');

    now += 501;
    expect(tracker.acquire(10)).toBe('key-3');
  });
});
