import { describe, expect, it } from 'vitest';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { crystalV2SnapshotFrom } from './crystalV2Sources';

// ============================================================
// Знімок порталу → знімок кристала v2 (ADR-0217).
// ------------------------------------------------------------
// Правила власника, які живуть саме в перекладі, а не в моделі:
// ріст дають лише ЗАВЕРШЕНІ плани, ВИКОНАНІ бажання, ПЕРЕГЛЯНУТІ медіа;
// колір бажання — за тим, ХТО виконав («дівчина виконує — червоний»).
// ============================================================

const EMPTY: EvolutionSourceSnapshot = {
  calendarEvents: [],
  plans: [],
  wishlistItems: [],
  mapPlaces: [],
  memories: [],
  memoryLinks: [],
  media: [],
};

const DIMA = 1;
const LENA = 2;

function from(snapshot: Partial<EvolutionSourceSnapshot>) {
  return crystalV2SnapshotFrom({
    relationshipStartedAt: '2022-12-26T00:00:00Z',
    asOf: '2026-09-27',
    snapshot: { ...EMPTY, ...snapshot },
    sharedDaysOff: ['2024-05-01'],
    partners: { first: DIMA, second: LENA },
  });
}

describe('кристал v2: переклад знімка порталу', () => {
  it('дати зрізані до дня, вихідні передані як є', () => {
    const result = from({});
    expect(result.startDate).toBe('2022-12-26');
    expect(result.asOf).toBe('2026-09-27');
    expect(result.daysOff).toEqual(['2024-05-01']);
  });

  it('ріст дають лише завершені плани, датовані днем завершення', () => {
    const plan = (id: number, status: string, completedAt: string | null) => ({
      id, category: 'trip', status, startDate: '2024-01-01', endDate: '2024-01-05', completedAt, createdAt: '2023-12-01',
    });
    const result = from({ plans: [plan(1, 'done', '2024-01-06'), plan(2, 'planned', null), plan(3, 'done', null)] });
    expect(result.plans).toEqual([{ id: 1, date: '2024-01-06' }, { id: 3, date: '2024-01-05' }]);
  });

  it('медіа рахуються лише переглянуті, за днем перегляду', () => {
    const result = from({
      media: [
        { id: 1, status: 'done', createdAt: '2023-01-01', finishedAt: '2024-02-02' },
        { id: 2, status: 'planned', createdAt: '2023-01-01', finishedAt: null },
      ],
    });
    expect(result.media).toEqual([{ id: 1, date: '2024-02-02' }]);
  });

  it('бажання Діми, виконане Лєною, тягне кристал у червоний; навпаки — у блакитний', () => {
    const wish = (id: number, ownerId: number, fulfilledById: number) => ({
      id, fulfilled: true, fulfilledAt: '2024-03-03', giftDate: null, isShared: false, priority: null, ownerId, fulfilledById,
    });
    const red = buildCrystalV2Model(from({ wishlistItems: [wish(1, DIMA, LENA), wish(2, DIMA, LENA), wish(3, DIMA, LENA)] }));
    const blue = buildCrystalV2Model(from({ wishlistItems: [wish(1, LENA, DIMA), wish(2, LENA, DIMA), wish(3, LENA, DIMA)] }));
    expect(red.colour.channel).toBe('red');
    expect(blue.colour.channel).toBe('blue');
  });

  it('невиконане бажання кольору не дає', () => {
    const result = from({
      wishlistItems: [{ id: 1, fulfilled: false, fulfilledAt: null, giftDate: null, isShared: false, priority: null, ownerId: DIMA, fulfilledById: null }],
    });
    expect(result.wishes).toEqual([]);
  });
});
