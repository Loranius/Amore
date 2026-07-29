import { SHOPPING_MAX_ACTIVITY, SHOPPING_MAX_STABILITY } from './rules';
import type {
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  ShoppingItemSource,
} from './types';
import {
  dateKeyInTimeZone,
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

export function adaptShoppingItems(
  rows: readonly ShoppingItemSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);
  const perDay = new Map<string, number>();

  for (const row of rows) {
    if (!row.bought) continue;
    if (!row.boughtAt) {
      result.diagnostics.push(diagnostic(
        'shopping',
        'missing_completion_date',
        row.id,
        'Bought shopping item has no bought_at timestamp.',
      ));
      continue;
    }

    const occursBy = eventOccursBy(row.boughtAt, asOfEpoch);
    const dateKey = dateKeyInTimeZone(row.boughtAt, context.timeZone);
    if (occursBy === null || !dateKey) {
      result.diagnostics.push(diagnostic(
        'shopping',
        'invalid_date',
        row.id,
        'Bought shopping item has an invalid bought_at timestamp.',
      ));
      continue;
    }
    if (!occursBy) continue;
    perDay.set(dateKey, (perDay.get(dateKey) ?? 0) + 1);
  }

  for (const [date, count] of [...perDay.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const stability = Math.min(
      SHOPPING_MAX_STABILITY,
      0.018 + Math.log2(count + 1) * 0.014,
    );
    const portalActivity = Math.min(
      SHOPPING_MAX_ACTIVITY,
      Math.sqrt(count) * 0.014,
    );

    result.events.push({
      id: `shopping:${date}:bought`,
      occurredAt: date,
      source: `shopping@${context.rulesVersion}`,
      evidence: 'verified',
      channels: withPressure({ stability }),
      portalActivity,
    });
  }

  return result;
}
