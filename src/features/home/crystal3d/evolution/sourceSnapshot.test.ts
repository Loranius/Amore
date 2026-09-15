import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WishlistEvolutionArchiveItem } from '@/features/wishlist/wishlistEvolutionArchive';
import { portalSnapshotFromRows } from '@/features/world/portalSources';
import {
  buildEvolutionMemoryLinks,
  evolutionWishlistFromPairArchive,
  resolveCrystalColorPartners,
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
    is_shared: false,
    owner: 1,
    fulfilled_by: 2,
    ...overrides,
  };
}

describe('Evolution real-data snapshot mapping', () => {
  it('maps pair-wide wishlist rows deterministically and preserves shared scope', () => {
    const result = evolutionWishlistFromPairArchive([
      archiveItem(4),
      archiveItem(2, { priority: 'low' }),
      archiveItem(2, {
        priority: 'high',
        fulfilled_at: '2026-02-03T09:00:00Z',
        is_shared: true,
      }),
    ]);

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
    /*
     * ВИМОГА: у Blueprint не потрапляє нічого презентаційного — ні
     * підписи, ні адреси фото. Рушій рахує з того, що ТРАПИЛОСЬ, і зайве
     * поле в знімку означало б, що воно поїде далі в хеш і в публікацію.
     *
     * Перевірка дісталась у спадок від видаленого другого перекладу
     * (ADR-0189) і тепер стереже той, що лишився, — `portalSnapshotFromRows`
     * у `portalSources.ts`. Саме тому вона не зникла разом із кодом: вона
     * стосується не файлу, а гарантії.
     */
    const snapshot = portalSnapshotFromRows({
      events: [{
        id: 1,
        date: '2025-02-14',
        type: 'anniversary',
        yearly: false,
        is_milestone: true,
      }],
      plans: [{
        id: 4,
        category: 'trip',
        status: 'done',
        start_date: '2025-03-01',
        end_date: '2025-03-04',
        completed_at: '2025-03-04T18:00:00Z',
        created_at: '2025-02-20T10:00:00Z',
      }],
      wishlistItems: evolutionWishlistFromPairArchive([archiveItem(6)]),
      pins: [{
        id: 7,
        category: 'visited',
        visited_at: '2025-03-02',
        created_at: '2025-03-05T10:00:00Z',
        rating: 5,
        city: 'Львів',
        country: 'Україна',
      }],
      memories: [{
        id: 30,
        memory_date: '2025-04-03',
        date_precision: 'day',
        taken_at: null,
        created_at: '2025-04-04T09:00:00Z',
      }],
      memoryLinkIds: { 30: { place: 7 } },
      media: [{
        id: 9,
        status: 'done',
        created_at: '2025-04-05T12:00:00Z',
        finished_at: null,
      }],
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
    expect(snapshot.media[0]).toEqual({
      id: 9, status: 'done', createdAt: '2025-04-05T12:00:00Z', finishedAt: null,
    });
  });

  it('портал має РІВНО ОДИН переклад рядків у знімок', () => {
    /*
     * **ВИМОГА (ADR-0189), знайдена підписом на головній.** Перекладів
     * було два: цей файл обслуговував кристал і дерево, `portalSources.ts`
     * — риф. Того самого дня вони дали 328 і 435 подій: другий бачив
     * домішку «сказаних» чисел онбордингу, перший — ні.
     *
     * Тест дивиться в текст, бо саме поява ДРУГОЇ такої функції і є вадою;
     * жодна перевірка поведінки одного знімка її не спіймає.
     */
    const files = [
      'src/features/home/crystal3d/evolution/useEvolutionCrystalPipeline.ts',
      'src/features/home/crystal3d/treeLab/useTreeLabPortalPreview.ts',
      'src/features/home/reef3d/world/useReefPlan.ts',
    ];
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      expect(source).toMatch(/usePortalSources\(/);
      expect(source).not.toMatch(/buildEvolutionSourceSnapshot/);
    }
  });

  it('derives the same couple id regardless of user order or duplicates', () => {
    expect(stableEvolutionCoupleId([8, 3, 8])).toBe('amore-couple:3-8');
    expect(stableEvolutionCoupleId([3, 8])).toBe('amore-couple:3-8');
    expect(() => stableEvolutionCoupleId([])).toThrow(/at least one user id/i);
  });
});

describe('crystal colour partners (ADR-0004)', () => {
  it('keeps the engine free of any notion of gender', () => {
    // The engine takes two opaque ids. Deciding which partner holds which
    // channel is an application concern precisely so it can move to a profile
    // field later without the engine changing at all.
    const partners = resolveCrystalColorPartners([
      { id: 2, name: 'Лєна' },
      { id: 1, name: 'Діма' },
    ]);

    expect(partners).toEqual({ first: 1, second: 2 });
    /*
     * І САМЕ ЦЕЙ ПОРЯДОК НЕСЕ ПРАВИЛО ВЛАСНИКА (ADR-0151): «якщо дівчина
     * виконує бажання, додається червоний; якщо хлопець — блакитний».
     *
     * Рушій фарбує червоним канал `toFirst` — бажання ПЕРШОГО, які виконав
     * ДРУГИЙ. Тож червоний означає «Лєна виконала бажання Діми» лише
     * доти, доки Діма тут перший. Поміняти місцями два імені вище — це
     * поміняти місцями червоний і блакитний, і жоден інший тест цього не
     * побачить: обидва стани однаково детерміновані.
     */
    expect(partners?.first).toBe(1);
  });

  it('is stable for an unrecognised couple rather than refusing to colour', () => {
    const partners = resolveCrystalColorPartners([
      { id: 9, name: 'Sam' },
      { id: 4, name: 'Alex' },
    ]);

    // Arbitrary but consistent: the couple gets stable colours, just not
    // necessarily the ones they would have chosen.
    expect(partners).toEqual({ first: 4, second: 9 });
    expect(resolveCrystalColorPartners([{ id: 9, name: 'Sam' }, { id: 4, name: 'Alex' }]))
      .toEqual(partners);
  });

  it('returns nothing when there is no couple to colour for', () => {
    expect(resolveCrystalColorPartners([])).toBeNull();
  });
});
