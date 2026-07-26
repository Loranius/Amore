import type { WishlistItemV3 } from './wishlistRpc';

export type PartnerWishFilter = 'available' | 'mine' | 'all';

export function filterPartnerWishes(
  items: WishlistItemV3[],
  filter: PartnerWishFilter,
  currentUserId: number,
): WishlistItemV3[] {
  if (filter === 'available') return items.filter((item) => !item.reserved);
  if (filter === 'mine') return items.filter((item) => item.reserved_by === currentUserId);
  return items;
}

export function partnerWishFilterCounts(items: WishlistItemV3[], currentUserId: number) {
  return {
    available: items.filter((item) => !item.reserved).length,
    mine: items.filter((item) => item.reserved_by === currentUserId).length,
    all: items.length,
  };
}
