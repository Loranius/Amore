import { describe, expect, it } from 'vitest';
import { filterPartnerWishes, partnerWishFilterCounts } from './partnerWishFilter';
import type { WishlistItemV3 } from './wishlistRpc';

const actorId = 2;
const items = [
  { id: 1, reserved: false, reserved_by: null },
  { id: 2, reserved: true, reserved_by: actorId },
  { id: 3, reserved: true, reserved_by: null },
] as WishlistItemV3[];

describe('partnerWishFilter', () => {
  it('separates available and current-user gifts without exposing masked reservations', () => {
    expect(filterPartnerWishes(items, 'available', actorId).map((item) => item.id)).toEqual([1]);
    expect(filterPartnerWishes(items, 'mine', actorId).map((item) => item.id)).toEqual([2]);
    expect(filterPartnerWishes(items, 'all', actorId).map((item) => item.id)).toEqual([1, 2, 3]);
  });

  it('returns accurate filter counts', () => {
    expect(partnerWishFilterCounts(items, actorId)).toEqual({ available: 1, mine: 1, all: 3 });
  });
});
