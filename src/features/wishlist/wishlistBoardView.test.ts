import { describe, expect, it } from 'vitest';
import {
  applyWishlistBoardView,
  wishlistPriorityFilterCounts,
} from './wishlistBoardView';
import type { WishlistItemV3 } from './wishlistRpc';

const items = [
  { id: 10, title: 'High', priority: 'high', price: 300, image_url: 'high.webp' },
  { id: 12, title: 'No photo', priority: 'medium', price: null, image_url: null },
  { id: 11, title: 'Dream', priority: 'dream', price: 100, image_url: 'dream.webp' },
] as WishlistItemV3[];

describe('applyWishlistBoardView', () => {
  it('filters by priority and missing photo', () => {
    expect(applyWishlistBoardView(items, { priority: 'dream', sort: 'newest' }).map((item) => item.id)).toEqual([11]);
    expect(applyWishlistBoardView(items, { priority: 'withoutPhoto', sort: 'newest' }).map((item) => item.id)).toEqual([12]);
  });

  it('sorts newest, priority and price with null prices last', () => {
    expect(applyWishlistBoardView(items, { priority: 'all', sort: 'newest' }).map((item) => item.id)).toEqual([12, 11, 10]);
    expect(applyWishlistBoardView(items, { priority: 'all', sort: 'priority' }).map((item) => item.id)).toEqual([11, 10, 12]);
    expect(applyWishlistBoardView(items, { priority: 'all', sort: 'price' }).map((item) => item.id)).toEqual([11, 10, 12]);
  });

  it('returns filter counts', () => {
    expect(wishlistPriorityFilterCounts(items)).toEqual({
      all: 3,
      dream: 1,
      high: 1,
      withoutPhoto: 1,
    });
  });
});
