import { PLAN_PRESSURES } from './rules';
import type { EvolutionAdapterContext, EvolutionAdapterResult, PlanSource } from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

export function adaptPlans(
  rows: readonly PlanSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);

  for (const row of rows) {
    if (row.status !== 'done') continue;

    const occurredAt = row.completedAt ?? row.endDate ?? row.startDate;
    if (!occurredAt) {
      result.diagnostics.push(diagnostic(
        'plans',
        'missing_completion_date',
        row.id,
        'Completed plan has no completed_at, end_date or start_date.',
      ));
      continue;
    }

    const occursBy = eventOccursBy(occurredAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'plans',
        'invalid_date',
        row.id,
        'Completed plan has an invalid completion date.',
      ));
      continue;
    }
    if (!occursBy) continue;

    const knownPressure = PLAN_PRESSURES[row.category];
    const pressure = knownPressure ?? PLAN_PRESSURES.other;
    if (!knownPressure) {
      result.diagnostics.push(diagnostic(
        'plans',
        'unsupported_category',
        row.id,
        `Unknown plan category "${row.category}" was mapped as "other".`,
      ));
    }

    result.events.push({
      id: `plan:${row.id}:completed`,
      episodeId: `plan:${row.id}:completion`,
      occurredAt,
      source: `plans@${context.rulesVersion}`,
      evidence: row.completedAt ? 'verified' : 'historical-estimate',
      channels: withPressure(pressure ?? {}),
      portalActivity: 0.32,
    });
  }

  return result;
}
