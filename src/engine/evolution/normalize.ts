import {
  EVOLUTION_CHANNELS,
  type EvolutionDiagnostics,
  type EvolutionEngineConfig,
  type EvolutionEventInput,
  type EvolutionPressureVector,
  type NormalizedEvolutionEvent,
} from './types';
import {
  parseCalendarDate,
  parseEvolutionInstant,
  relationshipEpochIndex,
} from './calendar';

export interface NormalizedEvolutionResult {
  events: NormalizedEvolutionEvent[];
  diagnostics: EvolutionDiagnostics;
}

function emptyPressureVector(): EvolutionPressureVector {
  return {
    achievement: 0,
    remembrance: 0,
    exploration: 0,
    culture: 0,
    stability: 0,
    significance: 0,
  };
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function candidateOrder(left: NormalizedEvolutionEvent, right: NormalizedEvolutionEvent): number {
  if (left.evidence !== right.evidence) return left.evidence === 'verified' ? -1 : 1;
  if (left.occurredAtEpochMs !== right.occurredAtEpochMs) {
    return left.occurredAtEpochMs - right.occurredAtEpochMs;
  }
  return compareStrings(left.id, right.id)
    || compareStrings(left.source, right.source)
    || compareStrings(JSON.stringify(left.channels), JSON.stringify(right.channels));
}

function timelineOrder(left: NormalizedEvolutionEvent, right: NormalizedEvolutionEvent): number {
  return left.occurredAtEpochMs - right.occurredAtEpochMs
    || compareStrings(left.id, right.id)
    || compareStrings(left.source, right.source);
}

function normalizeUnitValue(value: number | undefined, onClamp: () => void): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value)) {
    onClamp();
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, value));
  if (clamped !== value) onClamp();
  return clamped;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(compareStrings);
}

export function normalizeEvolutionEvents(
  inputs: readonly EvolutionEventInput[],
  config: EvolutionEngineConfig,
): NormalizedEvolutionResult {
  const relationshipStart = parseCalendarDate(config.relationshipStartedAt, config.timeZone);
  if (!relationshipStart) {
    throw new Error(`Invalid relationshipStartedAt: "${config.relationshipStartedAt}".`);
  }

  const diagnostics: EvolutionDiagnostics = {
    invalidEventIds: [],
    duplicateEventIds: [],
    duplicateEpisodeIds: [],
    estimatesReplacedByVerified: [],
    clampedChannelValues: 0,
    clampedPortalActivityValues: 0,
  };

  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const candidates: NormalizedEvolutionEvent[] = [];

  for (const input of inputs) {
    const id = input.id.trim();
    const source = input.source.trim();
    const epochMs = parseEvolutionInstant(input.occurredAt);
    const eventDate = parseCalendarDate(input.occurredAt, config.timeZone);

    if (!id || !source || epochMs === null || eventDate === null) {
      diagnostics.invalidEventIds.push(id || input.id || '(missing-id)');
      continue;
    }

    if (seenIds.has(id)) duplicateIds.add(id);
    seenIds.add(id);

    const channels = emptyPressureVector();
    for (const channel of EVOLUTION_CHANNELS) {
      channels[channel] = normalizeUnitValue(
        input.channels[channel],
        () => { diagnostics.clampedChannelValues += 1; },
      );
    }

    const portalActivity = normalizeUnitValue(
      input.portalActivity,
      () => { diagnostics.clampedPortalActivityValues += 1; },
    );

    candidates.push({
      id,
      episodeId: input.episodeId?.trim() || null,
      occurredAt: new Date(epochMs).toISOString(),
      occurredAtEpochMs: epochMs,
      source,
      evidence: input.evidence,
      epochIndex: relationshipEpochIndex(relationshipStart, eventDate, config.leapDayPolicy),
      channels,
      portalActivity,
    });
  }

  diagnostics.duplicateEventIds = uniqueSorted(duplicateIds);

  const groups = new Map<string, NormalizedEvolutionEvent[]>();
  for (const candidate of candidates) {
    const key = candidate.episodeId === null
      ? `event:${candidate.id}`
      : `episode:${candidate.episodeId}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const events: NormalizedEvolutionEvent[] = [];
  for (const group of groups.values()) {
    group.sort(candidateOrder);
    const selected = group[0];
    if (!selected) continue;

    if (selected.episodeId !== null && group.length > 1) {
      diagnostics.duplicateEpisodeIds.push(selected.episodeId);
      const hadEstimate = group.some((event) => event.evidence === 'historical-estimate');
      const hadVerified = group.some((event) => event.evidence === 'verified');
      if (hadEstimate && hadVerified && selected.evidence === 'verified') {
        diagnostics.estimatesReplacedByVerified.push(selected.episodeId);
      }
    }

    events.push(selected);
  }

  diagnostics.invalidEventIds = uniqueSorted(diagnostics.invalidEventIds);
  diagnostics.duplicateEpisodeIds = uniqueSorted(diagnostics.duplicateEpisodeIds);
  diagnostics.estimatesReplacedByVerified = uniqueSorted(diagnostics.estimatesReplacedByVerified);
  events.sort(timelineOrder);

  return { events, diagnostics };
}
