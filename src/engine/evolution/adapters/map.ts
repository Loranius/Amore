import { MAP_VISIT_PRESSURE } from './rules';
import type { EvolutionAdapterContext, EvolutionAdapterResult, MapPlaceSource } from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

export function adaptMapPlaces(
  rows: readonly MapPlaceSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);

  for (const row of rows) {
    if (!row.visitedAt) continue;

    const occursBy = eventOccursBy(row.visitedAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'map',
        'invalid_date',
        row.id,
        'Visited place has an invalid visited_at value.',
      ));
      continue;
    }
    if (!occursBy) continue;

    const rating = row.rating === null || !Number.isFinite(row.rating)
      ? 0
      : Math.min(5, Math.max(0, row.rating));
    const culturalContext = row.city || row.country ? MAP_VISIT_PRESSURE.culture : 0;

    result.events.push({
      id: `place:${row.id}:visited`,
      episodeId: `place:${row.id}:visit`,
      occurredAt: row.visitedAt,
      source: `map@${context.rulesVersion}`,
      evidence: 'verified',
      channels: withPressure({
        ...MAP_VISIT_PRESSURE,
        culture: culturalContext,
        significance: (rating / 5) * 0.18,
      }),
      portalActivity: 0.2,
    });
  }

  return result;
}
