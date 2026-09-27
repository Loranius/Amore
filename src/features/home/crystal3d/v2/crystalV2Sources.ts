// ============================================================
// Знімок порталу → знімок кристала v2 (ADR-0217).
// ------------------------------------------------------------
// Портал ходить у базу ОДНИМ запитом на всі види (`fetchPortalSources`,
// ADR-0189). Тут — лише переклад його рядків у плаский знімок моделі v2: хто,
// що і коли. Жодного рішення про ріст — вони всі в `crystalV2/model.ts`.
//
// Та сама форма знімка читається Python-двійником (`tools/crystal_twin`),
// тож знімок порталу можна зберегти й прогнати через двійник як є.
// ============================================================
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';

export interface CrystalV2SourceInput {
  relationshipStartedAt: string;
  /** День пари (YYYY-MM-DD), на який рахується кристал. */
  asOf: string;
  snapshot: EvolutionSourceSnapshot;
  sharedDaysOff: readonly string[];
  /**
   * Кольорові партнери (ADR-0004, ADR-0151). `first` — той, чиє бажання,
   * виконане `second`, тягне в червоний: правило власника «дівчина виконує —
   * червоний, хлопець — блакитний» з `resolveCrystalColorPartners`.
   */
  partners: { first: number | null; second: number | null } | null;
}

export function crystalV2SnapshotFrom(input: CrystalV2SourceInput): CrystalV2Snapshot {
  const { snapshot } = input;
  return {
    startDate: input.relationshipStartedAt.slice(0, 10),
    asOf: input.asOf.slice(0, 10),
    partners: {
      red: input.partners?.second ?? null,
      blue: input.partners?.first ?? null,
    },
    memories: snapshot.memories.map((row) => ({ id: row.id, date: row.memoryDate })),
    plans: snapshot.plans
      .filter((row) => row.status === 'done')
      .map((row) => ({ id: row.id, date: row.completedAt ?? row.endDate ?? row.startDate })),
    wishes: snapshot.wishlistItems
      .filter((row) => row.fulfilled)
      .map((row) => ({
        id: row.id,
        date: row.fulfilledAt ?? row.giftDate,
        isShared: row.isShared,
        ownerId: row.ownerId ?? null,
        fulfilledById: row.fulfilledById ?? null,
      })),
    events: snapshot.calendarEvents.map((row) => ({
      id: row.id,
      date: row.date,
      isMilestone: row.isMilestone,
    })),
    places: snapshot.mapPlaces.map((row) => ({ id: row.id, date: row.visitedAt ?? row.createdAt })),
    media: snapshot.media
      .filter((row) => row.status === 'done')
      .map((row) => ({ id: row.id, date: row.finishedAt ?? row.createdAt })),
    daysOff: [...input.sharedDaysOff],
  };
}
