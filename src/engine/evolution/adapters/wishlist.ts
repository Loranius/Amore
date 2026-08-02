import { WISHLIST_BASE_PRESSURE } from './rules';
import type { EvolutionAdapterContext, EvolutionAdapterResult, WishlistSource } from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

const PRIORITY_SIGNIFICANCE: Readonly<Record<string, number>> = {
  high: 0.34,
  medium: 0.18,
  low: 0.08,
};

function roundPressure(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function adaptWishlist(
  rows: readonly WishlistSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);

  for (const row of rows) {
    if (!row.fulfilled) continue;

    const occurredAt = row.fulfilledAt ?? row.giftDate;
    if (!occurredAt) {
      result.diagnostics.push(diagnostic(
        'wishlist',
        'missing_completion_date',
        row.id,
        'Fulfilled wish has neither fulfilled_at nor gift_date.',
      ));
      continue;
    }

    const occursBy = eventOccursBy(occurredAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'wishlist',
        'invalid_date',
        row.id,
        'Fulfilled wish has an invalid completion date.',
      ));
      continue;
    }
    if (!occursBy) continue;

    const priorityBoost = row.priority ? (PRIORITY_SIGNIFICANCE[row.priority] ?? 0) : 0;
    const sharedBoost = row.isShared ? 0.16 : 0;

    result.events.push({
      id: `wish:${row.id}:fulfilled`,
      episodeId: `wish:${row.id}:fulfillment`,
      occurredAt,
      source: `wishlist@${context.rulesVersion}`,
      evidence: row.fulfilledAt ? 'verified' : 'historical-estimate',
      channels: withPressure({
        ...WISHLIST_BASE_PRESSURE,
        significance: roundPressure(Math.min(
          1,
          WISHLIST_BASE_PRESSURE.significance + priorityBoost,
        )),
        stability: sharedBoost,
      }),
      portalActivity: 0.24,
      // Carried through for the crystal's annual colour (ADR-0004). It is the
      // only place in the pipeline that distinguishes a gift from one partner
      // to the other from something they chose together.
      attribution: {
        subjectId: row.ownerId ?? null,
        actorId: row.fulfilledById ?? null,
        shared: row.isShared,
      },
    });
  }

  return result;
}
