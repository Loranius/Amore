import {
  EVOLUTION_CHANNELS,
  type EvolutionEpochPressure,
  type EvolutionPressureLedger,
  type EvolutionPressureVector,
  type NormalizedEvolutionEvent,
} from './types';

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

function addEventToPressure(
  target: EvolutionPressureVector,
  event: NormalizedEvolutionEvent,
): void {
  for (const channel of EVOLUTION_CHANNELS) {
    target[channel] += event.channels[channel];
  }
}

function createEpoch(epochIndex: number): EvolutionEpochPressure {
  return {
    epochIndex,
    eventCount: 0,
    verifiedEventCount: 0,
    historicalEstimateCount: 0,
    channels: emptyPressureVector(),
    portalActivity: 0,
  };
}

export function buildPressureLedger(
  events: readonly NormalizedEvolutionEvent[],
): EvolutionPressureLedger {
  const channels = emptyPressureVector();
  const epochs = new Map<number, EvolutionEpochPressure>();
  let verifiedEventCount = 0;
  let historicalEstimateCount = 0;
  let portalActivity = 0;

  for (const event of events) {
    if (event.evidence === 'verified') verifiedEventCount += 1;
    else historicalEstimateCount += 1;

    portalActivity += event.portalActivity;
    addEventToPressure(channels, event);

    const epoch = epochs.get(event.epochIndex) ?? createEpoch(event.epochIndex);
    epoch.eventCount += 1;
    epoch.portalActivity += event.portalActivity;
    if (event.evidence === 'verified') epoch.verifiedEventCount += 1;
    else epoch.historicalEstimateCount += 1;
    addEventToPressure(epoch.channels, event);
    epochs.set(event.epochIndex, epoch);
  }

  return {
    eventCount: events.length,
    verifiedEventCount,
    historicalEstimateCount,
    channels,
    portalActivity,
    epochs: [...epochs.values()].sort((left, right) => left.epochIndex - right.epochIndex),
  };
}
