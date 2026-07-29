import { MEMORY_PRESSURE_BY_PRECISION } from './rules';
import type {
  EvolutionAdapterContext,
  EvolutionAdapterResult,
  MemoryLinkSource,
  MemorySourceRecord,
} from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

export function adaptMemories(
  rows: readonly MemorySourceRecord[],
  links: readonly MemoryLinkSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);
  const linkedIds = new Set(links.map((link) => link.memoryId));

  for (const row of rows) {
    const occurredAt = row.takenAt ?? row.memoryDate ?? row.createdAt;
    const occursBy = eventOccursBy(occurredAt, asOfEpoch);
    if (occursBy === null) {
      result.diagnostics.push(diagnostic(
        'memories',
        'invalid_date',
        row.id,
        'Memory has no usable date.',
      ));
      continue;
    }
    if (!occursBy) continue;

    const basePressure = MEMORY_PRESSURE_BY_PRECISION[row.datePrecision]
      ?? MEMORY_PRESSURE_BY_PRECISION.approx
      ?? 0.05;
    // Photos mirrored from another module still strengthen remembrance, but
    // less than a manually preserved memory because the source event already
    // contributes its own structural pressure.
    const remembrance = linkedIds.has(row.id) ? basePressure * 0.55 : basePressure;

    result.events.push({
      id: `memory:${row.id}:preserved`,
      occurredAt,
      source: `memories@${context.rulesVersion}`,
      evidence: row.takenAt || row.datePrecision === 'day'
        ? 'verified'
        : 'historical-estimate',
      channels: withPressure({ remembrance }),
      portalActivity: linkedIds.has(row.id) ? 0.025 : 0.05,
    });
  }

  return result;
}
