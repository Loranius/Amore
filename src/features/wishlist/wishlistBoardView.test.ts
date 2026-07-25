import { describe, expect, it } from 'vitest';
import {
  applyWishlistBoardView,
  DEFAULT_WISHLIST_BOARD_VIEW,
  wishlistPriorityFilterCounts,
} from './wishlistBoardView';
import type { WishlistItemV3 } from './wishlistRpc';

const items = [
  { id: 10, title: 'High', priority: 'high', price: 300, image_url: 'high.webp' },
  { id: 12, title: 'Medium', priority: 'medium', price: null, image_url: null },
  { id: 11, title: 'Legacy dream', priority: 'dream', price: 100, image_url: 'dream.webp' },
  { id: 9, title: 'Low', priority: 'low', price: 50, image_url: 'low.webp' },
] as WishlistItemV3[];

describe('applyWishlistBoardView', () => {
  it('filters the three supported priority levels', () => {
    expect(applyWishlistBoardView(items, { ...DEFAULT_WISHLIST_BOARD_VIEW, priority: 'high' }).map((item) => item.id)).toEqual([11, 10]);
    expect(applyWishlistBoardView(items, { ...DEFAULT_WISHLIST_BOARD_VIEW, priority: 'medium' }).map((item) => item.id)).toEqual([12]);
    expect(applyWishlistBoardView(items, { ...DEFAULT_WISHLIST_BOARD_VIEW, priority: 'low' }).map((item) => item.id)).toEqual([9]);
  });

  it('keeps the stable newest order used by the simplified toolbar', () => {
    expect(applyWishlistBoardView(items, DEFAULT_WISHLIST_BOARD_VIEW).map((item) => item.id)).toEqual([12, 11, 10, 9]);
  });

  it('uses bubbles as the default presentation', () => {
    expect(DEFAULT_WISHLIST_BOARD_VIEW.view).toBe('bubbles');
  });

  it('normalizes a cached legacy dream row into high priority', () => {
    expect(wishlistPriorityFilterCounts(items)).toEqual({
      all: 4,
      high: 2,
      medium: 1,
      low: 1,
    });
  });
});
