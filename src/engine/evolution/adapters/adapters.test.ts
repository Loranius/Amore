import { describe, expect, it } from 'vitest';
import { adaptCalendarEvents } from './calendar';
import { adaptMapPlaces } from './map';
import { adaptMemories } from './memories';
import { adaptPlans } from './plans';
import { EVOLUTION_ADAPTER_RULES_VERSION } from './rules';
import { adaptMedia } from './media';
import { buildArtifactFromSnapshot } from './assemble';
import { adaptWishlist } from './wishlist';
import type {
  EvolutionAdapterContext,
  EvolutionSourceSnapshot,
} from './types';

const context: EvolutionAdapterContext = {
  asOf: '2026-07-29T11:00:00+03:00',
  timeZone: 'Europe/Kyiv',
  leapDayPolicy: 'feb-28',
  rulesVersion: EVOLUTION_ADAPTER_RULES_VERSION,
};

function emptySnapshot(): EvolutionSourceSnapshot {
  return {
    calendarEvents: [],
    plans: [],
    wishlistItems: [],
    mapPlaces: [],
    memories: [],
    memoryLinks: [],
    media: [],
  };
}

describe('calendar adapter', () => {
  it('keeps only personal relationship events and expands yearly dates', () => {
    const result = adaptCalendarEvents([
      {
        id: 1,
        date: '2024-02-29',
        type: 'anniversary',
        yearly: true,
        isMilestone: true,
      },
      {
        id: 2,
        date: '2025-04-10',
        type: 'birthday',
        yearly: true,
        isMilestone: false,
      },
      {
        id: 3,
        date: '2025-12-25',
        type: 'holiday',
        yearly: true,
        isMilestone: false,
      },
      {
        id: 4,
        date: '2027-01-01',
        type: 'anniversary',
        yearly: false,
        isMilestone: false,
      },
    ], context);

    expect(result.events.map((event) => event.id)).toEqual([
      'calendar:1:origin',
      'calendar:1:year:2025',
      'calendar:1:year:2026',
    ]);
    expect(result.events[1]?.occurredAt).toBe('2025-02-28');
    expect(result.events[0]?.channels.significance).toBe(1);
    expect(result.events[1]?.evidence).toBe('historical-estimate');
  });

  it('makes a regular event lighter than a milestone', () => {
    const result = adaptCalendarEvents([
      { id: 1, date: '2025-01-01', type: 'anniversary', yearly: false, isMilestone: false },
      { id: 2, date: '2025-01-02', type: 'anniversary', yearly: false, isMilestone: true },
    ], context);

    expect(result.events[0]?.channels.significance).toBeLessThan(
      result.events[1]?.channels.significance ?? 0,
    );
    expect(result.events[0]?.channels.remembrance).toBeLessThan(
      result.events[1]?.channels.remembrance ?? 0,
    );
  });
});

describe('plans and wishlist adapters', () => {
  it('maps only completed plans and uses category-specific pressures', () => {
    const result = adaptPlans([
      {
        id: 1,
        category: 'trip',
        status: 'done',
        startDate: '2025-05-01',
        endDate: null,
        completedAt: '2025-05-03T19:00:00+03:00',
        createdAt: '2025-01-01T12:00:00Z',
      },
      {
        id: 2,
        category: 'home',
        status: 'planning',
        startDate: '2025-06-01',
        endDate: null,
        completedAt: null,
        createdAt: '2025-01-02T12:00:00Z',
      },
    ], context);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.channels.exploration).toBe(0.9);
    expect(result.events[0]?.evidence).toBe('verified');
  });

  it('diagnoses completed records without a usable date', () => {
    const planResult = adaptPlans([{
      id: 9,
      category: 'other',
      status: 'done',
      startDate: null,
      endDate: null,
      completedAt: null,
      createdAt: '2025-01-01T00:00:00Z',
    }], context);
    const wishResult = adaptWishlist([{
      id: 10,
      fulfilled: true,
      fulfilledAt: null,
      giftDate: null,
      isShared: false,
      priority: null,
    }], context);

    expect(planResult.events).toHaveLength(0);
    expect(planResult.diagnostics[0]?.code).toBe('missing_completion_date');
    expect(wishResult.events).toHaveLength(0);
    expect(wishResult.diagnostics[0]?.code).toBe('missing_completion_date');
  });

  it('gives shared high-priority fulfilled wishes more significance', () => {
    const result = adaptWishlist([{
      id: 1,
      fulfilled: true,
      fulfilledAt: '2025-07-01T12:00:00Z',
      giftDate: null,
      isShared: true,
      priority: 'high',
    }], context);

    expect(result.events[0]?.channels.significance).toBe(0.62);
    expect(result.events[0]?.channels.stability).toBe(0.16);
  });
});

describe('map, memories and media adapters', () => {
  it('maps verified visits and ignores map ideas without visited_at', () => {
    const result = adaptMapPlaces([
      {
        id: 1,
        category: 'visited',
        visitedAt: '2025-08-12',
        createdAt: '2025-08-13T00:00:00Z',
        rating: 5,
        city: 'Львів',
        country: 'Україна',
      },
      {
        id: 2,
        category: 'favorite',
        visitedAt: null,
        createdAt: '2025-08-13T00:00:00Z',
        rating: null,
        city: null,
        country: null,
      },
    ], context);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.channels.exploration).toBe(0.65);
    expect(result.events[0]?.channels.significance).toBe(0.18);
  });

  it('reduces pressure for photos automatically mirrored from another module', () => {
    const records = [{
      id: 1,
      memoryDate: '2025-08-12',
      datePrecision: 'day' as const,
      takenAt: null,
      createdAt: '2025-08-13T00:00:00Z',
    }];
    const manual = adaptMemories(records, [], context);
    const linked = adaptMemories(records, [
      { memoryId: 1, sourceType: 'place', sourceId: 7 },
    ], context);

    expect(manual.events[0]?.channels.remembrance).toBe(0.12);
    expect(linked.events[0]?.channels.remembrance).toBeCloseTo(0.066);
  });

  it('emits one culture event per finished item, and never claims it is verified', () => {
    // ADR-0017: media is the seventh source. The evidence grade is the point —
    // `finished_at` was backfilled from `created_at` for existing rows
    // (ADR-0080), so a date being present does not make it observed fact.
    const result = adaptMedia([
      { id: 1, status: 'done', createdAt: '2025-08-12T10:00:00+03:00', finishedAt: null },
      { id: 2, status: 'watching', createdAt: '2025-08-12T18:00:00+03:00', finishedAt: null },
      { id: 3, status: 'done', createdAt: null, finishedAt: null },
    ], context);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.id).toBe('media:1:finished');
    expect(result.events[0]?.evidence).toBe('historical-estimate');
    expect(result.events[0]?.channels.culture).toBeGreaterThan(0);
    // A film is not an anniversary: it may not carry significance at all.
    expect(result.events[0]?.channels.significance ?? 0).toBe(0);

    // A finished row with no date is reported, not silently dropped.
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('missing_completion_date');
    expect(result.diagnostics[0]?.source).toBe('media');
  });
});

describe('snapshot assembly', () => {
  it('produces the same blueprint regardless of database row order', () => {
    const snapshot: EvolutionSourceSnapshot = {
      ...emptySnapshot(),
      calendarEvents: [
        { id: 1, date: '2024-06-01', type: 'anniversary', yearly: false, isMilestone: true },
      ],
      plans: [
        {
          id: 4,
          category: 'trip',
          status: 'done',
          startDate: '2025-05-01',
          endDate: null,
          completedAt: '2025-05-03T19:00:00+03:00',
          createdAt: '2025-01-01T12:00:00Z',
        },
      ],
      wishlistItems: [
        {
          id: 3,
          fulfilled: true,
          fulfilledAt: '2025-02-01T14:00:00+02:00',
          giftDate: null,
          isShared: false,
          priority: 'medium',
        },
      ],
    };
    const reversed: EvolutionSourceSnapshot = {
      ...snapshot,
      calendarEvents: [...snapshot.calendarEvents].reverse(),
      plans: [...snapshot.plans].reverse(),
      wishlistItems: [...snapshot.wishlistItems].reverse(),
    };
    const input = {
      coupleId: 'dima-liena',
      engineConfig: {
        engineVersion: '1.0.0',
        relationshipStartedAt: '2024-06-01',
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28' as const,
      },
      asOf: context.asOf,
    };

    const first = buildArtifactFromSnapshot({ ...input, snapshot });
    const second = buildArtifactFromSnapshot({ ...input, snapshot: reversed });

    expect(second).toEqual(first);
    expect(first.blueprint.pressureLedger.eventCount).toBe(3);
    expect(first.adapterRulesVersion).toBe(EVOLUTION_ADAPTER_RULES_VERSION);
  });
});
