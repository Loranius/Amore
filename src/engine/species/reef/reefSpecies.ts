import {
  EVOLUTION_CHANNELS,
  type ArtifactBlueprint,
  type EvolutionChannel,
  type EvolutionPressureVector,
  type NormalizedEvolutionEvent,
} from '../../evolution';
import {
  parseCalendarDate,
  parseEvolutionInstant,
  relationshipEpochIndex,
} from '../../evolution/calendar';
import { buildPressureLedger } from '../../evolution/ledger';
import {
  channelEvenness,
  clamp01,
  daysBetweenExplicit,
  dominantChannel,
  maturityAt,
  normalizedShares,
  round6,
  saturate,
  seededUnit,
  stableSeed,
} from './math';
import { REEF_EVENT_SOURCE_MODULES } from './types';
import { buildReefModuleEvolution } from './moduleEvolution';
import type {
  BuildReefSpeciesBlueprintInput,
  ReefColonyMorphotype,
  ReefColonyRole,
  ReefColonyTier,
  ReefEventSourceModule,
  ReefGrowthGrammar,
  ReefGrowthInstruction,
  ReefLifeStage,
  ReefModuleEvolutionPlan,
  ReefSpeciesBlueprint,
  ReefSpeciesDiagnostics,
  ReefSpeciesPressures,
  ReefSpeciesState,
  ReefStructureInstruction,
} from './types';

const REEF_EVENT_SOURCE_SET = new Set<string>(REEF_EVENT_SOURCE_MODULES);
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface ReefScheduleDay {
  date: string;
  epochIndex: number;
}

interface NormalizedReefSchedule {
  days: ReefScheduleDay[];
  invalidDates: string[];
  duplicateDates: string[];
  futureDates: string[];
  preRelationshipDates: string[];
}

function sourceModuleFor(source: string): ReefEventSourceModule | null {
  const module = source.split('@', 1)[0]?.trim() ?? '';
  return REEF_EVENT_SOURCE_SET.has(module) ? module as ReefEventSourceModule : null;
}

function calendarDateNumber(date: { year: number; month: number; day: number }): number {
  return Date.UTC(date.year, date.month - 1, date.day);
}

function normalizeSharedDaysOff(
  artifact: ArtifactBlueprint,
  asOf: string,
  values: readonly string[],
): NormalizedReefSchedule {
  const relationshipStart = parseCalendarDate(
    artifact.relationshipStartedAt,
    artifact.timeZone,
  );
  const asOfDate = parseCalendarDate(asOf, artifact.timeZone);
  if (!relationshipStart || !asOfDate) {
    throw new Error('Reef Species could not normalize Schedule calendar dates.');
  }

  const relationshipStartNumber = calendarDateNumber(relationshipStart);
  const asOfNumber = calendarDateNumber(asOfDate);
  const accepted = new Map<string, ReefScheduleDay>();
  const seen = new Set<string>();
  const invalidDates = new Set<string>();
  const duplicateDates = new Set<string>();
  const futureDates = new Set<string>();
  const preRelationshipDates = new Set<string>();

  for (const rawValue of values) {
    const value = rawValue.trim();
    const date = DATE_ONLY_PATTERN.test(value)
      ? parseCalendarDate(value, artifact.timeZone)
      : null;
    if (!date) {
      invalidDates.add(rawValue);
      continue;
    }
    if (seen.has(value)) {
      duplicateDates.add(value);
      continue;
    }
    seen.add(value);

    const dateNumber = calendarDateNumber(date);
    if (dateNumber > asOfNumber) {
      futureDates.add(value);
      continue;
    }
    if (dateNumber < relationshipStartNumber) {
      preRelationshipDates.add(value);
      continue;
    }

    accepted.set(value, {
      date: value,
      epochIndex: relationshipEpochIndex(
        relationshipStart,
        date,
        artifact.leapDayPolicy,
      ),
    });
  }

  return {
    days: [...accepted.values()].sort((left, right) => left.date.localeCompare(right.date)),
    invalidDates: [...invalidDates].sort(),
    duplicateDates: [...duplicateDates].sort(),
    futureDates: [...futureDates].sort(),
    preRelationshipDates: [...preRelationshipDates].sort(),
  };
}

function stageFor(ageDays: number): ReefLifeStage {
  if (ageDays < 180) return 'settlement';
  if (ageDays < 365 * 2) return 'juvenile';
  if (ageDays < 365 * 5) return 'developing';
  if (ageDays < 365 * 12) return 'established';
  return 'ancient';
}

function completedRelationshipYears(artifact: ArtifactBlueprint, asOf: string): number {
  const relationshipStart = parseCalendarDate(
    artifact.relationshipStartedAt,
    artifact.timeZone,
  );
  const currentDate = parseCalendarDate(asOf, artifact.timeZone);
  if (!relationshipStart || !currentDate) {
    throw new Error('Reef Species could not resolve relationship calendar dates.');
  }
  return relationshipEpochIndex(relationshipStart, currentDate, artifact.leapDayPolicy);
}

function buildPressures(
  artifact: ArtifactBlueprint,
  sharedDaysOffCount: number,
): ReefSpeciesPressures {
  const vector = artifact.pressureLedger.channels;
  const shares = normalizedShares(vector);
  const dominant = dominantChannel(vector);
  const portalActivity = artifact.pressureLedger.portalActivity;
  // Schedule contributes as quiet, additive substrate support. It is kept out
  // of the neutral pressure ledger so it cannot masquerade as portal activity.
  const togetherness = saturate(sharedDaysOffCount, 18);

  return {
    substrateCoverage: saturate(
      vector.stability * 1.15 + vector.remembrance * 0.48
        + portalActivity * 0.32 + togetherness * 0.24,
      1.05,
    ),
    verticalComplexity: saturate(
      vector.achievement * 0.92 + vector.significance * 0.78
        + vector.exploration * 0.52 + portalActivity * 0.2,
      1.2,
    ),
    branchPotential: saturate(
      vector.achievement * 1.18 + vector.exploration * 0.58 + vector.significance * 0.34,
      1.05,
    ),
    platePotential: saturate(
      vector.exploration * 1.12 + vector.culture * 0.62 + vector.achievement * 0.22,
      0.95,
    ),
    encrustingPotential: saturate(
      vector.stability * 1.28 + vector.remembrance * 0.38
        + portalActivity * 0.18 + togetherness * 0.28,
      0.92,
    ),
    softCoralPotential: saturate(
      vector.culture * 1.08 + vector.remembrance * 0.52 + portalActivity * 0.5,
      1.05,
    ),
    resilience: saturate(
      vector.stability * 1.22 + vector.significance * 0.42
        + vector.remembrance * 0.28 + togetherness * 0.2,
      0.9,
    ),
    diversity: round6(clamp01(channelEvenness(vector) * 0.78 + portalActivity * 0.22)),
    currentBias: round6(clamp01(0.18 + dominant.share * 0.54 + shares.exploration * 0.2)),
    dominantChannel: dominant.channel,
    dominance: dominant.share,
    channelShare: shares,
  };
}

function buildState(
  artifact: ArtifactBlueprint,
  asOf: string,
  pressures: ReefSpeciesPressures,
  sharedDaysOffCount: number,
): ReefSpeciesState {
  const ageDays = daysBetweenExplicit(artifact.relationshipStartedAt, asOf);
  if (ageDays === null) {
    throw new Error(
      `Could not calculate reef age from "${artifact.relationshipStartedAt}" to "${asOf}".`,
    );
  }
  const completedYears = completedRelationshipYears(artifact, asOf);
  const eventCount = artifact.events.length;

  return {
    ageDays,
    completedYears,
    epochCount: completedYears + 1,
    eventCount,
    sharedDaysOffCount,
    stage: stageFor(ageDays),
    substrateMaturity: saturate(ageDays + eventCount * 28 + sharedDaysOffCount * 4, 680),
    colonyMaturity: saturate(ageDays + eventCount * 62, 940),
    biodiversityMaturity: round6(clamp01(
      saturate(ageDays + eventCount * 48, 820) * (0.56 + pressures.diversity * 0.44),
    )),
  };
}

function buildStructure(
  artifactSeed: number,
  evolution: ReefModuleEvolutionPlan,
): ReefStructureInstruction {
  const seed = stableSeed(artifactSeed, 'reef:structure');
  const maturity = evolution.foundation.radialSaturation;
  return {
    id: 'reef:structure',
    seed,
    substrateRadius: evolution.foundation.substrateRadius,
    reefHeight: round6(1.56 + maturity * 0.92 + seededUnit(seed, 'reef-height') * 0.18),
    shelfCount: 3 + Math.min(2, Math.floor(maturity * 3)),
    colonySpacing: round6(0.2 + seededUnit(seed, 'colony-spacing') * 0.035),
    verticalRelief: round6(0.4 + maturity * 0.24 + seededUnit(seed, 'vertical-relief') * 0.08),
    slopeBias: round6(0.12 + seededUnit(seed, 'slope-bias') * 0.18),
    currentDirectionRad: round6(seededUnit(seed, 'current-direction') * Math.PI * 2),
    currentStrength: round6(0.24 + seededUnit(seed, 'current-strength') * 0.26),
  };
}

function buildGrammar(artifactSeed: number): ReefGrowthGrammar {
  return {
    id: 'reef:growth-grammar',
    seed: stableSeed(artifactSeed, 'reef:growth-grammar'),
    radialBandCount: 5,
    verticalBandCount: 4,
    minimumSpacingRatio: 0.065,
    annualRecruitmentCount: 2,
    maximumAcceptedColonies: 144,
    morphotypeOrder: [
      'encrusting',
      'massive',
      'branching',
      'plating',
      'soft-coral',
      'sea-fan',
    ],
  };
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

function halfLifeFor(morphotype: ReefColonyMorphotype): number {
  if (morphotype === 'massive' || morphotype === 'encrusting') return 150;
  if (morphotype === 'branching' || morphotype === 'plating') return 105;
  return 82;
}

function footprintFor(morphotype: ReefColonyMorphotype, weight: number): number {
  const base = morphotype === 'encrusting' ? 0.72
    : morphotype === 'massive' ? 0.58
      : morphotype === 'plating' ? 0.62
        : morphotype === 'soft-coral' ? 0.42
          : morphotype === 'sea-fan' ? 0.34
            : 0.38;
  return round6(clamp01(base * (0.68 + weight * 0.42)));
}

function heightBiasFor(morphotype: ReefColonyMorphotype, weight: number): number {
  const base = morphotype === 'branching' ? 0.82
    : morphotype === 'sea-fan' ? 0.76
      : morphotype === 'soft-coral' ? 0.62
        : morphotype === 'plating' ? 0.48
          : morphotype === 'massive' ? 0.44
            : 0.18;
  return round6(clamp01(base * (0.74 + weight * 0.34)));
}

function branchingBiasFor(morphotype: ReefColonyMorphotype, weight: number): number {
  const base = morphotype === 'branching' ? 0.92
    : morphotype === 'sea-fan' ? 0.74
      : morphotype === 'soft-coral' ? 0.5
        : morphotype === 'plating' ? 0.26
          : 0.08;
  return round6(clamp01(base * (0.72 + weight * 0.36)));
}

function seededMorphotype(
  seed: number,
  label: string,
  morphotypes: readonly ReefColonyMorphotype[],
): ReefColonyMorphotype {
  const index = Math.min(
    morphotypes.length - 1,
    Math.floor(seededUnit(seed, label) * morphotypes.length),
  );
  return morphotypes[index] ?? 'massive';
}

/**
 * Keeps module meaning intact while preventing real portal histories from
 * collapsing into only one or two silhouettes. One event still owns exactly
 * one append-stable colony; its seed selects a bounded visual habit.
 */
function morphotypeForEvent(
  sourceModule: ReefEventSourceModule,
  channel: EvolutionChannel,
  channelStrength: number,
  emphasized: boolean,
  seed: number,
): ReefColonyMorphotype {
  if (sourceModule === 'memories') return 'encrusting';
  if (sourceModule === 'wishlist') {
    if (emphasized) return 'massive';
    if (channelStrength >= 0.7) {
      return channel === 'achievement'
        ? 'branching'
        : channel === 'culture'
          ? 'soft-coral'
          : 'massive';
    }
    return seededMorphotype(seed, 'wishlist-morphotype', [
      'branching',
      'plating',
      'soft-coral',
    ]);
  }
  if (sourceModule === 'media') {
    if (channelStrength >= 0.5) return channel === 'culture' ? 'soft-coral' : 'plating';
    return seededMorphotype(seed, 'media-morphotype', [
      'plating',
      'soft-coral',
      'sea-fan',
    ]);
  }
  if (sourceModule === 'calendar') {
    if (channel === 'culture' && channelStrength >= 0.5) return 'sea-fan';
    if (emphasized) return 'massive';
    if (channelStrength >= 0.7) return 'massive';
    return seededMorphotype(seed, 'calendar-morphotype', [
      'massive',
      'plating',
      'sea-fan',
    ]);
  }
  return channel === 'achievement'
    ? 'branching'
    : channel === 'culture'
      ? 'soft-coral'
      : 'massive';
}

function buildEventInstruction(
  artifactSeed: number,
  event: NormalizedEvolutionEvent,
  sourceModule: ReefEventSourceModule,
  asOf: string,
  grammar: ReefGrowthGrammar,
): ReefGrowthInstruction | null {
  // Plans become fish and Map facts become satellite rock. They are accepted
  // reef facts, but must never silently manufacture a coral colony.
  if (sourceModule === 'plans' || sourceModule === 'map') return null;

  const fallbackChannel: EvolutionChannel = sourceModule === 'memories'
    ? 'remembrance'
    : sourceModule === 'media'
      ? 'culture'
      : 'significance';
  const channel = eventDominantChannel(event.channels) ?? fallbackChannel;
  const totalPressure = EVOLUTION_CHANNELS.reduce(
    (total, candidate) => total + event.channels[candidate],
    0,
  );
  const signalWeight = saturate(totalPressure + event.portalActivity * 0.16, 1.08);
  const weight = round6(sourceModule === 'memories'
    ? 0.2 + signalWeight * 0.24
    : sourceModule === 'media'
      ? 0.32 + signalWeight * 0.3
      : 0.46 + signalWeight * 0.42);
  const emphasized = event.channels.significance >= 0.75
    || (event.channels.significance >= 0.56 && weight >= 0.62);
  const id = `reef:event:${event.id}`;
  const seed = stableSeed(artifactSeed, id);
  const morphotype = morphotypeForEvent(
    sourceModule,
    channel,
    event.channels[channel],
    emphasized,
    seed,
  );
  const role: ReefColonyRole = sourceModule === 'memories'
    ? 'memory'
    : sourceModule === 'media'
      ? 'ornamental'
      : sourceModule === 'calendar'
        ? 'landmark'
        : 'framework';
  const tier: ReefColonyTier = sourceModule === 'memories'
    ? 'micro'
    : sourceModule === 'media'
      ? 'companion'
      : emphasized ? 'anchor' : 'primary';
  const radialBase = sourceModule === 'memories'
    ? Math.floor(seededUnit(seed, 'photo-radius') * grammar.radialBandCount)
    : sourceModule === 'media'
      ? 2
      : sourceModule === 'calendar'
        ? 2
        : 1;
  const verticalBase = morphotype === 'encrusting' ? 0
    : morphotype === 'massive' ? 1
      : morphotype === 'plating' ? 2
        : 2;
  const footprintScale = sourceModule === 'memories' ? 0.42 : 1;

  return {
    id,
    sourceModule,
    sourceEventId: event.id,
    sourceEpisodeId: event.episodeId,
    epochIndex: event.epochIndex,
    sequence: event.occurredAtEpochMs * 10 + 5,
    channel,
    morphotype,
    role,
    tier,
    emphasized,
    weight,
    maturity: maturityAt(event.occurredAt, asOf, halfLifeFor(morphotype)),
    preferredAzimuthRad: round6(seededUnit(seed, 'azimuth') * Math.PI * 2),
    radialBand: Math.min(
      grammar.radialBandCount - 1,
      radialBase + Math.floor(seededUnit(seed, 'radial-band') * 2),
    ),
    verticalBand: Math.min(
      grammar.verticalBandCount - 1,
      verticalBase + Math.floor(seededUnit(seed, 'vertical-band') * 2),
    ),
    footprint: round6(footprintFor(morphotype, weight) * footprintScale),
    heightBias: heightBiasFor(morphotype, weight),
    branchingBias: branchingBiasFor(morphotype, weight),
    // A committed portal fact maps to one stable living body. Density is
    // expressed through many facts, never by cloning one fact into overlaps.
    recruitCount: 1,
    seed,
  };
}

function buildGrowth(
  artifact: ArtifactBlueprint,
  asOf: string,
  grammar: ReefGrowthGrammar,
  schedule: NormalizedReefSchedule,
  evolution: ReefModuleEvolutionPlan,
): { growth: ReefGrowthInstruction[]; diagnostics: ReefSpeciesDiagnostics } {
  const asOfEpoch = Date.parse(asOf);
  if (!Number.isFinite(asOfEpoch)) throw new Error(`Invalid Reef Species asOf: "${asOf}".`);

  const events: ReefGrowthInstruction[] = [];
  const excludedEventIds: string[] = [];
  const zeroPressureEventIds: string[] = [];
  const futureEventIds: string[] = [];
  const acceptedEventCountByModule: Record<ReefEventSourceModule, number> = {
    calendar: 0,
    plans: 0,
    wishlist: 0,
    map: 0,
    memories: 0,
    media: 0,
  };

  for (const event of artifact.events) {
    const sourceModule = sourceModuleFor(event.source);
    if (!sourceModule) {
      excludedEventIds.push(event.id);
      continue;
    }
    if (event.occurredAtEpochMs > asOfEpoch) {
      futureEventIds.push(event.id);
      continue;
    }
    acceptedEventCountByModule[sourceModule] += 1;
    if (eventDominantChannel(event.channels) === null) {
      zeroPressureEventIds.push(event.id);
    }
    const instruction = buildEventInstruction(
      artifact.deterministicSeed,
      event,
      sourceModule,
      asOf,
      grammar,
    );
    if (instruction) events.push(instruction);
  }

  const growth = [...events].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
  const emittedColonyIntentCount = growth.reduce(
    (total, instruction) => total + instruction.recruitCount,
    0,
  );

  return {
    growth,
    diagnostics: {
      emptyHistory: Object.values(acceptedEventCountByModule).every((count) => count === 0)
        && schedule.days.length === 0,
      excludedEventIds: excludedEventIds.sort(),
      zeroPressureEventIds: zeroPressureEventIds.sort(),
      futureEventIds: futureEventIds.sort(),
      invalidSharedDayOffDates: schedule.invalidDates,
      duplicateSharedDayOffDates: schedule.duplicateDates,
      futureSharedDayOffDates: schedule.futureDates,
      preRelationshipSharedDayOffDates: schedule.preRelationshipDates,
      acceptedEventCountByModule,
      sharedDaysOffCount: schedule.days.length,
      // Kept for diagnostics compatibility: these counts now describe
      // geological structures, not synthetic coral instructions.
      annualInstructionCount: evolution.foundation.arches.logicalCount,
      eventInstructionCount: events.length,
      scheduleInstructionCount: evolution.foundation.scheduleTerraces.logicalCount,
      emittedColonyIntentCount,
      maximumAcceptedColonies: grammar.maximumAcceptedColonies,
      colonyBudgetExceeded: emittedColonyIntentCount > grammar.maximumAcceptedColonies,
    },
  };
}

/**
 * Pure Reef Species entry point. It translates a species-neutral artifact into
 * deterministic substrate, current and colony-growth intent. It never imports
 * React, Three.js, Supabase, geometry, materials or UI.
 */
export function buildReefSpeciesBlueprint(
  input: BuildReefSpeciesBlueprintInput,
): ReefSpeciesBlueprint {
  const rulesVersion = input.config.rulesVersion.trim();
  if (!rulesVersion) throw new Error('Reef Species requires a non-empty rulesVersion.');

  const asOfEpoch = parseEvolutionInstant(input.config.asOf);
  if (asOfEpoch === null) throw new Error(`Invalid Reef Species asOf: "${input.config.asOf}".`);
  const asOf = new Date(asOfEpoch).toISOString();
  const schedule = normalizeSharedDaysOff(
    input.artifact,
    asOf,
    input.config.sharedDaysOff ?? [],
  );

  const currentEvents = input.artifact.events.filter(
    (event) => sourceModuleFor(event.source) !== null && event.occurredAtEpochMs <= asOfEpoch,
  );
  const currentArtifact = {
    ...input.artifact,
    events: currentEvents,
    pressureLedger: buildPressureLedger(currentEvents),
  };

  const pressures = buildPressures(currentArtifact, schedule.days.length);
  const state = buildState(currentArtifact, asOf, pressures, schedule.days.length);
  const moduleEvolution = buildReefModuleEvolution({
    artifact: input.artifact,
    asOfEpochMs: asOfEpoch,
    ageDays: state.ageDays,
    completedYears: state.completedYears,
    sharedDaysOff: schedule.days,
  });
  const structure = buildStructure(input.artifact.deterministicSeed, moduleEvolution);
  const grammar = buildGrammar(input.artifact.deterministicSeed);
  const { growth, diagnostics } = buildGrowth(
    input.artifact,
    asOf,
    grammar,
    schedule,
    moduleEvolution,
  );

  return {
    speciesBlueprintVersion: 1,
    species: 'reef',
    rulesVersion,
    sourceBlueprintVersion: input.artifact.blueprintVersion,
    engineVersion: input.artifact.engineVersion,
    coupleId: input.artifact.coupleId,
    artifactSeed: input.artifact.deterministicSeed,
    asOf,
    pressures,
    state,
    moduleEvolution,
    structure,
    grammar,
    growth,
    diagnostics,
  };
}
