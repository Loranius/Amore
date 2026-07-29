import {
  EVOLUTION_CHANNELS,
  type ArtifactBlueprint,
  type EvolutionChannel,
  type EvolutionPressureVector,
  type NormalizedEvolutionEvent,
} from '../../evolution';
import { parseCalendarDate } from '../../evolution/calendar';
import {
  clamp01,
  maturityAt,
  round6,
  saturate,
  seededUnit,
  stableSeed,
  vectorTotal,
} from './math';
import type {
  TreeBranchKind,
  TreeBranchTier,
  TreeGrowthInstruction,
  TreeSpeciesDiagnostics,
  TreeStructureInstruction,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function anniversaryEpoch(artifact: ArtifactBlueprint, epochIndex: number): number {
  const start = parseCalendarDate(artifact.relationshipStartedAt, artifact.timeZone);
  if (!start) throw new Error('Tree Species could not resolve relationship start date.');
  const year = start.year + epochIndex;
  let month = start.month;
  let day = start.day;
  if (month === 2 && day === 29 && !isLeapYear(year)) {
    if (artifact.leapDayPolicy === 'feb-28') day = 28;
    else {
      month = 3;
      day = 1;
    }
  }
  return Date.UTC(year, month - 1, day);
}

function eventDominantChannel(vector: EvolutionPressureVector): EvolutionChannel | null {
  let channel: EvolutionChannel | null = null;
  let value = 0;
  for (const candidate of EVOLUTION_CHANNELS) {
    if (vector[candidate] > value) {
      channel = candidate;
      value = vector[candidate];
    }
  }
  return channel;
}

function kindFor(channel: EvolutionChannel, emphasized: boolean): TreeBranchKind {
  if (emphasized || channel === 'significance') return 'landmark';
  if (channel === 'achievement') return 'crown';
  if (channel === 'remembrance') return 'memory';
  if (channel === 'exploration') return 'explorer';
  if (channel === 'culture') return 'ornamental';
  return 'support';
}

function tierFor(weight: number, emphasized: boolean): TreeBranchTier {
  if (emphasized) return 'support';
  if (weight >= 0.62) return 'family';
  if (weight >= 0.34) return 'companion';
  return 'micro';
}

function halfLifeFor(kind: TreeBranchKind): number {
  if (kind === 'landmark') return 150;
  if (kind === 'support' || kind === 'annual-bough') return 120;
  if (kind === 'crown' || kind === 'explorer') return 90;
  return 70;
}

function directionRange(channel: EvolutionChannel): {
  minElevation: number;
  elevationSpan: number;
  minRadial: number;
  radialSpan: number;
} {
  if (channel === 'achievement') {
    return { minElevation: 0.67, elevationSpan: 0.26, minRadial: 0.34, radialSpan: 0.34 };
  }
  if (channel === 'remembrance') {
    return { minElevation: 0.43, elevationSpan: 0.28, minRadial: 0.3, radialSpan: 0.34 };
  }
  if (channel === 'exploration') {
    return { minElevation: 0.48, elevationSpan: 0.31, minRadial: 0.68, radialSpan: 0.28 };
  }
  if (channel === 'culture') {
    return { minElevation: 0.5, elevationSpan: 0.3, minRadial: 0.54, radialSpan: 0.34 };
  }
  if (channel === 'stability') {
    return { minElevation: 0.32, elevationSpan: 0.25, minRadial: 0.2, radialSpan: 0.3 };
  }
  return { minElevation: 0.7, elevationSpan: 0.25, minRadial: 0.38, radialSpan: 0.34 };
}

export function buildTreeStructure(artifactSeed: number): TreeStructureInstruction {
  const seed = stableSeed(artifactSeed, 'tree:structure');
  return {
    id: 'tree:structure',
    seed,
    trunkHeight: round6(2.72 + seededUnit(seed, 'trunk-height') * 0.26),
    trunkStep: round6(0.33 + seededUnit(seed, 'trunk-step') * 0.035),
    branchStep: round6(0.225 + seededUnit(seed, 'branch-step') * 0.035),
    crownRadius: round6(2.02 + seededUnit(seed, 'crown-radius') * 0.34),
    crownHeight: round6(2.32 + seededUnit(seed, 'crown-height') * 0.34),
    baseRadius: round6(0.265 + seededUnit(seed, 'base-radius') * 0.035),
    radiusDecay: round6(0.7 + seededUnit(seed, 'radius-decay') * 0.045),
    upwardBias: round6(0.16 + seededUnit(seed, 'upward-bias') * 0.055),
    directionMemory: round6(0.31 + seededUnit(seed, 'direction-memory') * 0.07),
    lateralJitter: round6(0.09 + seededUnit(seed, 'lateral-jitter') * 0.045),
  };
}

function buildAnnualInstruction(
  artifact: ArtifactBlueprint,
  epochIndex: number,
): TreeGrowthInstruction {
  const id = `tree:annual:${epochIndex}`;
  const seed = stableSeed(artifact.deterministicSeed, id);
  const preferredElevation = round6(0.43 + seededUnit(seed, 'elevation') * 0.32);
  return {
    id,
    sourceEventId: null,
    sourceEpisodeId: null,
    epochIndex,
    sequence: anniversaryEpoch(artifact, epochIndex) * 10,
    channel: null,
    kind: 'annual-bough',
    tier: 'family',
    emphasized: false,
    weight: round6(0.42 + seededUnit(seed, 'weight') * 0.16),
    maturity: 1,
    preferredAzimuthRad: round6(
      (epochIndex * GOLDEN_ANGLE + seededUnit(seed, 'azimuth') * 0.38) % (Math.PI * 2),
    ),
    preferredElevation,
    radialBias: round6(0.46 + seededUnit(seed, 'radial') * 0.28),
    crownLayer: round6(clamp01((preferredElevation - 0.28) / 0.7)),
    attractorCount: 1,
    seed,
  };
}

function buildEventInstruction(
  artifactSeed: number,
  event: NormalizedEvolutionEvent,
  asOf: string,
): TreeGrowthInstruction | null {
  const channel = eventDominantChannel(event.channels);
  if (channel === null) return null;

  const totalPressure = vectorTotal(event.channels);
  const weight = saturate(totalPressure + event.portalActivity * 0.14, 1.08);
  const emphasized = event.channels.significance >= 0.75
    || (event.channels.significance >= 0.56 && weight >= 0.62);
  const kind = kindFor(channel, emphasized);
  const id = `tree:event:${event.id}`;
  const seed = stableSeed(artifactSeed, id);
  const range = directionRange(channel);
  const preferredElevation = round6(
    range.minElevation + seededUnit(seed, 'elevation') * range.elevationSpan,
  );
  const radialBias = round6(
    range.minRadial + seededUnit(seed, 'radial') * range.radialSpan,
  );
  const attractorCount = emphasized ? 3 : weight >= 0.55 ? 2 : 1;

  return {
    id,
    sourceEventId: event.id,
    sourceEpisodeId: event.episodeId,
    epochIndex: event.epochIndex,
    sequence: event.occurredAtEpochMs * 10 + 5,
    channel,
    kind,
    tier: tierFor(weight, emphasized),
    emphasized,
    weight,
    maturity: maturityAt(event.occurredAt, asOf, halfLifeFor(kind)),
    preferredAzimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
    preferredElevation,
    radialBias,
    crownLayer: round6(clamp01((preferredElevation - 0.28) / 0.7)),
    attractorCount,
    seed,
  };
}

export function buildTreeGrowthInstructions(
  artifact: ArtifactBlueprint,
  asOf: string,
  completedYears: number,
): { growth: TreeGrowthInstruction[]; diagnostics: TreeSpeciesDiagnostics } {
  const asOfEpoch = Date.parse(asOf);
  if (!Number.isFinite(asOfEpoch)) throw new Error(`Invalid Tree Species asOf: "${asOf}".`);

  const annual = Array.from(
    { length: completedYears },
    (_value, index) => buildAnnualInstruction(artifact, index + 1),
  );
  const events: TreeGrowthInstruction[] = [];
  const zeroPressureEventIds: string[] = [];
  const futureEventIds: string[] = [];

  for (const event of artifact.events) {
    if (event.occurredAtEpochMs > asOfEpoch) {
      futureEventIds.push(event.id);
      continue;
    }
    const instruction = buildEventInstruction(artifact.deterministicSeed, event, asOf);
    if (!instruction) {
      zeroPressureEventIds.push(event.id);
      continue;
    }
    events.push(instruction);
  }

  const growth = [...annual, ...events].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );

  return {
    growth,
    diagnostics: {
      emptyHistory: events.length === 0,
      zeroPressureEventIds: zeroPressureEventIds.sort(),
      futureEventIds: futureEventIds.sort(),
      annualInstructionCount: annual.length,
      eventInstructionCount: events.length,
    },
  };
}
