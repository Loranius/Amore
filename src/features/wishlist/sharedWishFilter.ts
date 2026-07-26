import type { WishlistItemV3 } from './wishlistRpc';

export type SharedWishFilter = 'all' | 'mine' | 'partner';

export function filterSharedWishes(
  items: WishlistItemV3[],
  filter: SharedWishFilter,
  currentUserId: number,
  partnerId: number,
): WishlistItemV3[] {
  if (filter === 'mine') return items.filter((item) => item.owner === currentUserId);
  if (filter === 'partner') return items.filter((item) => item.owner === partnerId);
  return items;
}

export function sharedWishFilterCounts(
  items: WishlistItemV3[],
  currentUserId: number,
  partnerId: number,
) {
  return {
    all: items.length,
    mine: items.filter((item) => item.owner === currentUserId).length,
    partner: items.filter((item) => item.owner === partnerId).length,
  };
}
