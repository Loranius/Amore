import { describe, expect, it } from 'vitest';
import { filterSharedWishes, sharedWishFilterCounts } from './sharedWishFilter';
import type { WishlistItemV3 } from './wishlistRpc';

const meId = 1;
const partnerId = 2;
const items = [
  { id: 10, owner: meId },
  { id: 11, owner: partnerId },
  { id: 12, owner: partnerId },
] as WishlistItemV3[];

describe('sharedWishFilter', () => {
  it('filters shared ideas by their owner', () => {
    expect(filterSharedWishes(items, 'mine', meId, partnerId).map((item) => item.id)).toEqual([10]);
    expect(filterSharedWishes(items, 'partner', meId, partnerId).map((item) => item.id)).toEqual([11, 12]);
    expect(filterSharedWishes(items, 'all', meId, partnerId)).toHaveLength(3);
  });

  it('returns author counts', () => {
    expect(sharedWishFilterCounts(items, meId, partnerId)).toEqual({ all: 3, mine: 1, partner: 2 });
  });
});
