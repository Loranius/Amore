import { describe, expect, it } from 'vitest';
import {
  applyWishlistBoardView,
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
    expect(applyWishlistBoardView(items, { priority: 'high', sort: 'newest' }).map((item) => item.id)).toEqual([11, 10]);
    expect(applyWishlistBoardView(items, { priority: 'medium', sort: 'newest' }).map((item) => item.id)).toEqual([12]);
    expect(applyWishlistBoardView(items, { priority: 'low', sort: 'newest' }).map((item) => item.id)).toEqual([9]);
  });

  it('keeps the stable newest order used by the simplified toolbar', () => {
    expect(applyWishlistBoardView(items, { priority: 'all', sort: 'newest' }).map((item) => item.id)).toEqual([12, 11, 10, 9]);
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
