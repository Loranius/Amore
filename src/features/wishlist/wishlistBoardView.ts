import type { WishlistItemV3 } from './wishlistRpc';

export type WishlistPriorityFilter = 'all' | 'dream' | 'high' | 'medium' | 'low';
export type WishlistSort = 'newest' | 'priority' | 'price';

export interface WishlistBoardViewState {
  priority: WishlistPriorityFilter;
  // Sorting is no longer exposed in the UI. Keep the stable default internally
  // for backward-compatible per-tab state without changing WishlistPage orchestration.
  sort: WishlistSort;
}

const PRIORITY_RANK: Record<string, number> = {
  dream: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const DEFAULT_WISHLIST_BOARD_VIEW: WishlistBoardViewState = {
  priority: 'all',
  sort: 'newest',
};

function priorityValue(item: WishlistItemV3): string {
  return String(item.priority ?? '');
}

function matchesPriority(item: WishlistItemV3, filter: WishlistPriorityFilter): boolean {
  if (filter === 'all') return true;
  return priorityValue(item) === filter;
}

function compareBySort(a: WishlistItemV3, b: WishlistItemV3, sort: WishlistSort): number {
  if (sort === 'priority') {
    const rankDifference = (PRIORITY_RANK[priorityValue(a)] ?? 99)
      - (PRIORITY_RANK[priorityValue(b)] ?? 99);
    return rankDifference || b.id - a.id;
  }

  if (sort === 'price') {
    if (a.price == null && b.price == null) return b.id - a.id;
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return a.price - b.price || b.id - a.id;
  }

  return b.id - a.id;
}

export function applyWishlistBoardView(
  items: WishlistItemV3[],
  state: WishlistBoardViewState,
): WishlistItemV3[] {
  return items
    .filter((item) => matchesPriority(item, state.priority))
    .sort((a, b) => compareBySort(a, b, state.sort));
}

export function wishlistPriorityFilterCounts(items: WishlistItemV3[]) {
  return {
    all: items.length,
    dream: items.filter((item) => priorityValue(item) === 'dream').length,
    high: items.filter((item) => priorityValue(item) === 'high').length,
    medium: items.filter((item) => priorityValue(item) === 'medium').length,
    low: items.filter((item) => priorityValue(item) === 'low').length,
  } satisfies Record<WishlistPriorityFilter, number>;
}
