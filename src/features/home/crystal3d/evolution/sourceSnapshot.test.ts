import { describe, expect, it } from 'vitest';
import type { MemoriesArchive } from '@/features/memories/useMemories';
import type { WishlistEvolutionArchiveItem } from '@/features/wishlist/wishlistEvolutionArchive';
import type { EventRow, MapPinRow, PlanRow, ShoppingItemRow } from '@/types';
import {
  buildEvolutionMemoryLinks,
  buildEvolutionSourceSnapshot,
  dedupeEvolutionWishlist,
  stableEvolutionCoupleId,
} from './sourceSnapshot';

function archiveItem(
  id: number,
  overrides: Partial<WishlistEvolutionArchiveItem> = {},
): WishlistEvolutionArchiveItem {
  return {
    id,
    priority: 'medium',
    fulfilled_at: '2026-01-02T10:00:00Z',
    completed_at: '2026-01-02T10:00:00Z',
    ...overrides,
  };
}

describe('Evolution real-data snapshot mapping', () => {
  it('deduplicates wishlist archives deterministically and lets shared scope win', () => {
    const result = dedupeEvolutionWishlist(
      [archiveItem(4), archiveItem(2, { priority: 'low' })],
      [archiveItem(2, { priority: 'high', fulfilled_at: '2026-02-03T09:00:00Z' })],
    );

    expect(result.map((item) => item.id)).toEqual([2, 4]);
    expect(result[0]).toMatchObject({
      id: 2,
      isShared: true,
      priority: 'high',
      fulfilledAt: '2026-02-03T09:00:00Z',
    });
    expect(result[1]?.isShared).toBe(false);
  });

  it('filters unsupported memory sources and publishes stable ordering', () => {
    const result = buildEvolutionMemoryLinks({
      8: { place: 14, wish: 3, plan: 9 },
      2: { event: 6, goal: 5 },
      4: { wish: Number.NaN },
    });

    expect(result).toEqual([
      { memoryId: 2, sourceType: 'event', sourceId: 6 },
      { memoryId: 2, sourceType: 'goal', sourceId: 5 },
      { memoryId: 8, sourceType: 'place', sourceId: 14 },
      { memoryId: 8, sourceType: 'wish', sourceId: 3 },
    ]);
  });

  it('maps current Amore rows without leaking presentation-only fields', () => {
    const archive: MemoriesArchive = {
      photos: [{
        id: 30,
        photo_url: 'https://example.test/memory.webp',
        storage_bucket: null,
        storage_path: null,
        memory_date: '2025-04-03',
        date_precision: 'day',
        taken_at: null,
        caption: 'Не потрапляє у Blueprint',
        uploaded_by: 1,
        sort_order: 0,
        created_at: '2025-04-04T09:00:00Z',
      }],
      links: { 30: ['place'] },
      linkIds: { 30: { place: 7 } },
      days: { '2025-04-03': 'Опис дня' },
    };

    const snapshot = buildEvolutionSourceSnapshot({
      events: [{
        id: 1,
        title: 'Пропозиція',
        description: null,
        date: '2025-02-14',
        created_by: 1,
        type: 'anniversary',
        yearly: false,
        metadata: null,
        is_milestone: true,
        person_user_id: null,
      } as EventRow],
      plans: [{
        id: 4,
        title: 'Подорож',
        description: null,
        category: 'trip',
        status: 'done',
        cover_url: null,
        url: null,
        start_date: '2025-03-01',
        end_date: '2025-03-04',
        start_time: null,
        date_precision: 'day',
        location_name: null,
        place_id: null,
        budget: null,
        proposed_by: null,
        confirmed: true,
        created_by: 1,
        created_at: '2025-02-20T10:00:00Z',
        updated_at: '2025-03-04T18:00:00Z',
        completed_at: '2025-03-04T18:00:00Z',
      } as PlanRow],
      wishlist: dedupeEvolutionWishlist([archiveItem(6)], []),
      pins: [{
        id: 7,
        title: 'Львів',
        note: null,
        category: 'visited',
        lat: 49.8,
        lng: 24.0,
        photo_url: null,
        rating: 5,
        review: null,
        city: 'Львів',
        country: 'Україна',
        created_by: 1,
        created_at: '2025-03-05T10:00:00Z',
        visited_at: '2025-03-02',
      } as MapPinRow],
      archive,
      shopping: [{
        id: 9,
        title: 'Молоко',
        qty: null,
        category: 'Напої',
        bought: true,
        created_by: 1,
        bought_by: 2,
        bought_at: '2025-04-05T17:00:00Z',
        created_at: '2025-04-05T12:00:00Z',
      } as ShoppingItemRow],
    });

    expect(snapshot.calendarEvents[0]).toEqual({
      id: 1,
      date: '2025-02-14',
      type: 'anniversary',
      yearly: false,
      isMilestone: true,
    });
    expect(snapshot.plans[0]).toMatchObject({ id: 4, status: 'done', completedAt: '2025-03-04T18:00:00Z' });
    expect(snapshot.mapPlaces[0]).toMatchObject({ id: 7, city: 'Львів', country: 'Україна' });
    expect(snapshot.memories[0]).toEqual({
      id: 30,
      memoryDate: '2025-04-03',
      datePrecision: 'day',
      takenAt: null,
      createdAt: '2025-04-04T09:00:00Z',
    });
    expect(snapshot.memoryLinks).toEqual([{ memoryId: 30, sourceType: 'place', sourceId: 7 }]);
    expect(snapshot.shoppingItems[0]).toMatchObject({ id: 9, bought: true });
    expect(JSON.stringify(snapshot)).not.toContain('Не потрапляє у Blueprint');
    expect(JSON.stringify(snapshot)).not.toContain('example.test');
  });

  it('derives the same couple id regardless of user order or duplicates', () => {
    expect(stableEvolutionCoupleId([8, 3, 8])).toBe('amore-couple:3-8');
    expect(stableEvolutionCoupleId([3, 8])).toBe('amore-couple:3-8');
    expect(() => stableEvolutionCoupleId([])).toThrow(/at least one user id/i);
  });
});
