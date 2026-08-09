import type { MemoriesArchive } from '@/features/memories/useMemories';
import type { WishlistEvolutionArchiveItem } from '@/features/wishlist/wishlistEvolutionArchive';
import type {
  EventRow,
  MapPinRow,
  MediaItemRow,
  PlanRow,
} from '@/types';
import type {
  EvolutionSourceSnapshot,
  MemoryLinkSource,
  WishlistSource,
} from '@/engine/evolution/adapters';

const ALLOWED_MEMORY_SOURCES = new Set(['wish', 'place', 'goal', 'event']);

export function archiveToWishlistSource(
  item: WishlistEvolutionArchiveItem,
): WishlistSource {
  return {
    id: item.id,
    fulfilled: true,
    fulfilledAt: item.fulfilled_at ?? item.completed_at,
    giftDate: item.completed_at,
    isShared: item.is_shared,
    priority: item.priority,
    ownerId: item.owner,
    fulfilledById: item.fulfilled_by,
  };
}

/**
 * Which partner holds the red channel of a year's colour, and which the blue
 * (ADR-0004).
 *
 * The engine takes two opaque ids and has no idea what they mean; deciding
 * belongs here. Today it reads the partner's name, which is the pattern the
 * rest of the app already uses for anything gendered (see
 * `wishlist/partnerLabel.ts`). When the planned user profile lands, this
 * function reads a field instead and nothing else changes.
 *
 * With no recognised names it falls back to id order, which is stable and
 * arbitrary — the couple gets consistent colours, just not necessarily the
 * ones they would have picked. Returns null only when there is no couple.
 */
export function resolveCrystalColorPartners(
  users: readonly { id: number; name: string }[],
): { first: number | null; second: number | null } | null {
  if (users.length === 0) return null;

  const byId = [...users].sort((left, right) => left.id - right.id);
  const named = (name: string): number | null =>
    byId.find((user) => user.name === name)?.id ?? null;

  const first = named('Діма');
  const second = named('Лєна');
  if (first !== null && second !== null) return { first, second };

  return { first: byId[0]?.id ?? null, second: byId[1]?.id ?? null };
}

export function evolutionWishlistFromPairArchive(
  rows: readonly WishlistEvolutionArchiveItem[],
): WishlistSource[] {
  const byId = new Map<number, WishlistSource>();
  for (const item of rows) byId.set(item.id, archiveToWishlistSource(item));
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
      if (
        !ALLOWED_MEMORY_SOURCES.has(sourceType)
        || typeof sourceId !== 'number'
        || !Number.isSafeInteger(sourceId)
      ) continue;
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

/** The three columns the engine reads; see `useFinishedMedia`. */
export type MediaRowsForEvolution = Pick<MediaItemRow, 'id' | 'status' | 'created_at'>;

export interface EvolutionSnapshotRows {
  events: readonly EventRow[];
  plans: readonly PlanRow[];
  wishlist: readonly WishlistSource[];
  pins: readonly MapPinRow[];
  archive: MemoriesArchive;
  media: readonly MediaRowsForEvolution[];
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
    media: input.media.map((item) => ({
      id: item.id,
      status: item.status,
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
