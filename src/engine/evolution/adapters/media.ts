// ============================================================
// media — фільми, серіали й книжки, які пара закінчила.
// ------------------------------------------------------------
// Сьоме джерело подій, і воно виправляє знаменник: `yearActivity`
// міряє рік тим, скількох модулів порталу він торкнувся, а вотчліст
// у ті модулі не входив. Рік, проведений за спільними фільмами,
// реєструвався як порожній.
// ============================================================
import { MEDIA_FINISHED_PRESSURE } from './rules';
import type {
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  MediaSource,
} from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

/**
 * One event per finished item, dated by `finished_at` when the portal knows it.
 *
 * **The column now exists** (migration 2026-09-01) and `created_at` is only the
 * fallback for rows that predate it being written. The cost of the stand-in was
 * measured on the owner's live data before the change: all 194 finished items
 * sat in relationship year 4, because that is when the watchlist was entered
 * into the portal, and years 1–3 received nothing from media at all.
 *
 * **Every event here is still `historical-estimate`, and that is deliberate.**
 * The migration seeded `finished_at` from `created_at` for existing rows by the
 * owner's decision, so a present value does not prove the date was ever
 * observed — a seeded estimate and a real completion are indistinguishable in
 * the column. Upgrading the grade would claim a certainty the data cannot
 * support. It costs nothing: media events carry no `episodeId`, so evidence
 * never decides between duplicates here.
 */
export function adaptMedia(
  rows: readonly MediaSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);

  for (const row of rows) {
    if (row.status !== 'done') continue;
    const occurredAt = row.finishedAt ?? row.createdAt;
    if (!occurredAt) {
      result.diagnostics.push(diagnostic(
        'media',
        'missing_completion_date',
        row.id,
        'Finished media item has neither finished_at nor created_at to date it by.',
      ));
      continue;
    }

    const occursBy = eventOccursBy(occurredAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'media',
        'invalid_date',
        row.id,
        'Finished media item has an invalid completion timestamp.',
      ));
      continue;
    }
    if (!occursBy) continue;

    result.events.push({
      id: `media:${row.id}:finished`,
      occurredAt,
      source: `media@${context.rulesVersion}`,
      // Never `verified`: see the note above — the backfill made a seeded
      // estimate indistinguishable from an observed completion.
      evidence: 'historical-estimate',
      channels: withPressure(MEDIA_FINISHED_PRESSURE),
      portalActivity: 0.08,
    });
  }

  return result;
}
