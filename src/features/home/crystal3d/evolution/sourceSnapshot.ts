import type { MemoriesArchive } from '@/features/memories/useMemories';
import type { WishlistEvolutionArchiveItem } from '@/features/wishlist/wishlistEvolutionArchive';
import type {
  EventRow,
  MapPinRow,
  PlanRow,
  ShoppingItemRow,
} from '@/types';
import type {
  EvolutionSourceSnapshot,
  MemoryLinkSource,
  WishlistSource,
} from '@/engine/evolution/adapters';

const ALLOWED_MEMORY_SOURCES = new Set(['wish', 'place', 'goal', 'event']);

export function archiveToWishlistSource(
  item: WishlistEvolutionArchiveItem,
  isShared: boolean,
): WishlistSource {
  return {
    id: item.id,
    fulfilled: true,
    fulfilledAt: item.fulfilled_at ?? item.completed_at,
    giftDate: item.completed_at,
    isShared,
    priority: item.priority,
  };
}

export function dedupeEvolutionWishlist(
  personal: readonly WishlistEvolutionArchiveItem[],
  shared: readonly WishlistEvolutionArchiveItem[],
): WishlistSource[] {
  const byId = new Map<number, WishlistSource>();
  for (const item of personal) byId.set(item.id, archiveToWishlistSource(item, false));
  // Shared wins if a backend scope ever returns the same row in both archives.
  for (const item of shared) byId.set(item.id, archiveToWishlistSource(item, true));
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

export function buildEvolutionMemoryLinks(
  linkIds: Record<number, Partial<Record<string, number>>>,
): MemoryLinkSource[] {
  const links: MemoryLinkSource[] = [];
  for (const [memoryIdText, sources] of Object.entries(linkIds)) {
    const memoryId = Number(memoryIdText);
    if (!Number.isSafeInteger(memoryId)) continue;
    for (const [sourceType, sourceId] of Object.entries(sources)) {
      if (!ALLOWED_MEMORY_SOURCES.has(sourceType) || !Number.isSafeInteger(sourceId)) continue;
      links.push({
        memoryId,
        sourceType: sourceType as MemoryLinkSource['sourceType'],
        sourceId,
      });
    }
  }
  return links.sort((left, right) =>
    left.memoryId - right.memoryId
      || left.sourceType.localeCompare(right.sourceType)
      || left.sourceId - right.sourceId,
  );
}

export interface EvolutionSnapshotRows {
  events: readonly EventRow[];
  plans: readonly PlanRow[];
  wishlist: readonly WishlistSource[];
  pins: readonly MapPinRow[];
  archive: MemoriesArchive;
  shopping: readonly ShoppingItemRow[];
}

export function buildEvolutionSourceSnapshot(
  input: EvolutionSnapshotRows,
): EvolutionSourceSnapshot {
  return {
    calendarEvents: input.events.map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      yearly: event.yearly,
      isMilestone: event.is_milestone,
    })),
    plans: input.plans.map((plan) => ({
      id: plan.id,
      category: plan.category,
      status: plan.status,
      startDate: plan.start_date,
      endDate: plan.end_date,
      completedAt: plan.completed_at,
      createdAt: plan.created_at,
    })),
    wishlistItems: [...input.wishlist],
    mapPlaces: input.pins.map((pin) => ({
      id: pin.id,
      category: pin.category,
      visitedAt: pin.visited_at,
      createdAt: pin.created_at,
      rating: pin.rating,
      city: pin.city,
      country: pin.country,
    })),
    memories: input.archive.photos.map((memory) => ({
      id: memory.id,
      memoryDate: memory.memory_date,
      datePrecision: memory.date_precision,
      takenAt: memory.taken_at,
      createdAt: memory.created_at,
    })),
    memoryLinks: buildEvolutionMemoryLinks(
      input.archive.linkIds as Record<number, Partial<Record<string, number>>>,
    ),
    shoppingItems: input.shopping.map((item) => ({
      id: item.id,
      bought: item.bought,
      boughtAt: item.bought_at,
      createdAt: item.created_at,
    })),
  };
}

export function stableEvolutionCoupleId(userIds: readonly number[]): string {
  const normalized = [...new Set(userIds)]
    .filter(Number.isSafeInteger)
    .sort((left, right) => left - right);
  if (normalized.length === 0) throw new Error('Evolution preview requires at least one user id.');
  return `amore-couple:${normalized.join('-')}`;
}
