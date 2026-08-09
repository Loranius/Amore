import type {
  EventRow,
  MapPinRow,
  MediaItemRow,
  MemoryLinkRow,
  MemoryRow,
  PlanRow,
  WishlistItemRow,
} from '@/types';
import type { EvolutionSourceSnapshot } from './types';

export interface AmoreEvolutionRows {
  events: readonly EventRow[];
  plans: readonly PlanRow[];
  wishlistItems: readonly WishlistItemRow[];
  mapPins: readonly MapPinRow[];
  memories: readonly MemoryRow[];
  memoryLinks: readonly MemoryLinkRow[];
  media: readonly MediaItemRow[];
}

/**
 * Pure transport mapper from current Amore table rows to the versioned adapter
 * contract. It performs no queries and has no React or Supabase dependency.
 */
export function toEvolutionSourceSnapshot(rows: AmoreEvolutionRows): EvolutionSourceSnapshot {
  return {
    calendarEvents: rows.events.map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      yearly: event.yearly,
      isMilestone: event.is_milestone,
    })),
    plans: rows.plans.map((plan) => ({
      id: plan.id,
      category: plan.category,
      status: plan.status,
      startDate: plan.start_date,
      endDate: plan.end_date,
      completedAt: plan.completed_at,
      createdAt: plan.created_at,
    })),
    wishlistItems: rows.wishlistItems.map((wish) => ({
      id: wish.id,
      fulfilled: wish.fulfilled,
      fulfilledAt: wish.fulfilled_at,
      giftDate: wish.gift_date,
      isShared: wish.is_shared,
      priority: wish.priority,
    })),
    mapPlaces: rows.mapPins.map((place) => ({
      id: place.id,
      category: place.category,
      visitedAt: place.visited_at,
      createdAt: place.created_at,
      rating: place.rating,
      city: place.city,
      country: place.country,
    })),
    memories: rows.memories.map((memory) => ({
      id: memory.id,
      memoryDate: memory.memory_date,
      datePrecision: memory.date_precision,
      takenAt: memory.taken_at,
      createdAt: memory.created_at,
    })),
    memoryLinks: rows.memoryLinks.map((link) => ({
      memoryId: link.memory_id,
      sourceType: link.source_type,
      sourceId: link.source_id,
    })),
    media: rows.media.map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.created_at,
    })),
  };
}
