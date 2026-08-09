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
 * One event per finished item.
 *
 * **The date is an estimate, and that is a property of the data rather than a
 * choice.** `media_items` records when a row was *created*, not when the couple
 * finished the thing, so a series added in January and finished in June lands
 * in January. Every event here is therefore `historical-estimate`, the same
 * evidence grade a memory with a month-precision date carries.
 *
 * The honest fix is a `finished_at` column on `media_items`, written when the
 * status moves to `done`. Until it exists this adapter cannot do better, and
 * pretending otherwise by inventing a completion date would be worse.
 */
export function adaptMedia(
  rows: readonly MediaSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);

  for (const row of rows) {
    if (row.status !== 'done') continue;
    if (!row.createdAt) {
      result.diagnostics.push(diagnostic(
        'media',
        'missing_completion_date',
        row.id,
        'Finished media item has no created_at timestamp to date it by.',
      ));
      continue;
    }

    const occursBy = eventOccursBy(row.createdAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'media',
        'invalid_date',
        row.id,
        'Finished media item has an invalid created_at timestamp.',
      ));
      continue;
    }
    if (!occursBy) continue;

    result.events.push({
      id: `media:${row.id}:finished`,
      occurredAt: row.createdAt,
      source: `media@${context.rulesVersion}`,
      // Never `verified`: see the note above — this is the date the row was
      // created, standing in for a completion date the table does not keep.
      evidence: 'historical-estimate',
      channels: withPressure(MEDIA_FINISHED_PRESSURE),
      portalActivity: 0.08,
    });
  }

  return result;
}
