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
  vectorTotal,
} from './math';
import { REEF_EVENT_SOURCE_MODULES } from './types';
import type {
  BuildReefSpeciesBlueprintInput,
  ReefColonyMorphotype,
  ReefColonyRole,
  ReefColonyTier,
  ReefEventSourceModule,
  ReefGrowthGrammar,
  ReefGrowthInstruction,
  ReefLifeStage,
  ReefSpeciesBlueprint,
  ReefSpeciesDiagnostics,
  ReefSpeciesPressures,
  ReefSpeciesState,
  ReefStructureInstruction,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const FOUNDATION_MORPHOTYPES: readonly ReefColonyMorphotype[] = [
  'encrusting',
  'massive',
  'soft-coral',
];
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

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function anniversaryEpoch(artifact: ArtifactBlueprint, epochIndex: number): number {
  const start = parseCalendarDate(artifact.relationshipStartedAt, artifact.timeZone);
  if (!start) throw new Error('Reef Species could not resolve relationship start date.');
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

function buildStructure(artifactSeed: number): ReefStructureInstruction {
  const seed = stableSeed(artifactSeed, 'reef:structure');
  return {
    id: 'reef:structure',
    seed,
    substrateRadius: round6(2.5 + seededUnit(seed, 'substrate-radius') * 0.45),
    reefHeight: round6(1.72 + seededUnit(seed, 'reef-height') * 0.38),
    shelfCount: 3 + Math.floor(seededUnit(seed, 'shelf-count') * 3),
    colonySpacing: round6(0.17 + seededUnit(seed, 'colony-spacing') * 0.045),
    verticalRelief: round6(0.42 + seededUnit(seed, 'vertical-relief') * 0.18),
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

function morphotypeFor(
  channel: EvolutionChannel,
  emphasized: boolean,
): ReefColonyMorphotype {
  if (channel === 'significance') return 'massive';
  if (channel === 'achievement') return 'branching';
  if (channel === 'remembrance') return 'massive';
  if (channel === 'exploration') return 'plating';
  if (channel === 'culture') return emphasized ? 'sea-fan' : 'soft-coral';
  return 'encrusting';
}

function roleFor(channel: EvolutionChannel, emphasized: boolean): ReefColonyRole {
  if (emphasized || channel === 'significance') return 'landmark';
  if (channel === 'achievement') return 'framework';
  if (channel === 'remembrance') return 'memory';
  if (channel === 'exploration') return 'frontier';
  if (channel === 'culture') return 'ornamental';
  return 'foundation';
}

function tierFor(weight: number, emphasized: boolean): ReefColonyTier {
  if (emphasized) return 'anchor';
  if (weight >= 0.62) return 'primary';
  if (weight >= 0.34) return 'companion';
  return 'micro';
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

function buildAnnualInstruction(
  artifact: ArtifactBlueprint,
  grammar: ReefGrowthGrammar,
  epochIndex: number,
): ReefGrowthInstruction {
  const id = `reef:annual:${epochIndex}`;
  const seed = stableSeed(artifact.deterministicSeed, id);
  const morphotype = FOUNDATION_MORPHOTYPES[
    Math.min(
      FOUNDATION_MORPHOTYPES.length - 1,
      Math.floor(seededUnit(seed, 'morphotype') * FOUNDATION_MORPHOTYPES.length),
    )
  ] ?? 'encrusting';
  const weight = round6(0.38 + seededUnit(seed, 'weight') * 0.16);

  return {
    id,
    sourceModule: 'relationship',
    sourceEventId: null,
    sourceEpisodeId: null,
    epochIndex,
    sequence: anniversaryEpoch(artifact, epochIndex) * 10,
    channel: null,
    morphotype,
    role: 'foundation',
    tier: 'primary',
    emphasized: false,
    weight,
    maturity: 1,
    preferredAzimuthRad: round6(
      (epochIndex * GOLDEN_ANGLE + seededUnit(seed, 'azimuth') * 0.34) % (Math.PI * 2),
    ),
    radialBand: Math.min(
      grammar.radialBandCount - 1,
      1 + Math.floor(seededUnit(seed, 'radial-band') * (grammar.radialBandCount - 1)),
    ),
    verticalBand: Math.floor(seededUnit(seed, 'vertical-band') * 2),
    footprint: footprintFor(morphotype, weight),
    heightBias: heightBiasFor(morphotype, weight),
    branchingBias: branchingBiasFor(morphotype, weight),
    recruitCount: grammar.annualRecruitmentCount,
    seed,
  };
}

function buildEventInstruction(
  artifactSeed: number,
  event: NormalizedEvolutionEvent,
  sourceModule: ReefEventSourceModule,
  asOf: string,
  grammar: ReefGrowthGrammar,
): ReefGrowthInstruction | null {
  const channel = eventDominantChannel(event.channels);
  if (channel === null) return null;

  const totalPressure = vectorTotal(event.channels);
  const weight = saturate(totalPressure + event.portalActivity * 0.16, 1.08);
  const emphasized = event.channels.significance >= 0.75
    || (event.channels.significance >= 0.56 && weight >= 0.62);
  const morphotype = morphotypeFor(channel, emphasized);
  const id = `reef:event:${event.id}`;
  const seed = stableSeed(artifactSeed, id);
  const radialBase = channel === 'stability' ? 0
    : channel === 'remembrance' ? 1
      : channel === 'achievement' ? 2
        : channel === 'culture' ? 2
          : channel === 'exploration' ? 3
            : 1;
  const verticalBase = morphotype === 'encrusting' ? 0
    : morphotype === 'massive' ? 1
      : morphotype === 'plating' ? 2
        : 2;
  const recruitCount = emphasized ? 3 : weight >= 0.55 ? 2 : 1;

  return {
    id,
    sourceModule,
    sourceEventId: event.id,
    sourceEpisodeId: event.episodeId,
    epochIndex: event.epochIndex,
    sequence: event.occurredAtEpochMs * 10 + 5,
    channel,
    morphotype,
    role: roleFor(channel, emphasized),
    tier: tierFor(weight, emphasized),
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
    footprint: footprintFor(morphotype, weight),
    heightBias: heightBiasFor(morphotype, weight),
    branchingBias: branchingBiasFor(morphotype, weight),
    recruitCount,
    seed,
  };
}

function buildScheduleInstructions(
  artifact: ArtifactBlueprint,
  schedule: NormalizedReefSchedule,
  asOf: string,
  grammar: ReefGrowthGrammar,
): ReefGrowthInstruction[] {
  const daysByEpoch = new Map<number, ReefScheduleDay[]>();
  for (const day of schedule.days) {
    const epochDays = daysByEpoch.get(day.epochIndex) ?? [];
    epochDays.push(day);
    daysByEpoch.set(day.epochIndex, epochDays);
  }

  return [...daysByEpoch.entries()]
    .sort(([left], [right]) => left - right)
    .map(([epochIndex, days]) => {
      const id = `reef:schedule:${epochIndex}`;
      const seed = stableSeed(artifact.deterministicSeed, id);
      const monthCount = new Set(days.map((day) => day.date.slice(0, 7))).size;
      const daySignal = saturate(days.length, 12);
      const regularitySignal = saturate(monthCount, 4);
      const weight = round6(clamp01(0.18 + daySignal * 0.42 + regularitySignal * 0.12));
      const morphotype: ReefColonyMorphotype = 'encrusting';

      return {
        id,
        sourceModule: 'schedule',
        sourceEventId: null,
        sourceEpisodeId: null,
        epochIndex,
        // Fixed to the relationship epoch boundary: adding another recorded
        // day changes fullness, never the identity or chronological anchor.
        sequence: anniversaryEpoch(artifact, epochIndex) * 10 + 3,
        channel: null,
        morphotype,
        role: 'foundation',
        tier: days.length >= 18 ? 'primary' : days.length >= 5 ? 'companion' : 'micro',
        emphasized: false,
        weight,
        maturity: maturityAt(days[0]?.date ?? asOf, asOf, 120),
        preferredAzimuthRad: round6(
          (epochIndex * GOLDEN_ANGLE + seededUnit(seed, 'azimuth') * 0.44) % (Math.PI * 2),
        ),
        radialBand: Math.min(
          grammar.radialBandCount - 1,
          Math.floor(seededUnit(seed, 'radial-band') * 2),
        ),
        verticalBand: 0,
        footprint: footprintFor(morphotype, weight),
        heightBias: heightBiasFor(morphotype, weight),
        branchingBias: branchingBiasFor(morphotype, weight),
        recruitCount: days.length >= 12 ? 2 : 1,
        seed,
      };
    });
}

function buildGrowth(
  artifact: ArtifactBlueprint,
  asOf: string,
  completedYears: number,
  grammar: ReefGrowthGrammar,
  schedule: NormalizedReefSchedule,
): { growth: ReefGrowthInstruction[]; diagnostics: ReefSpeciesDiagnostics } {
  const asOfEpoch = Date.parse(asOf);
  if (!Number.isFinite(asOfEpoch)) throw new Error(`Invalid Reef Species asOf: "${asOf}".`);

  const annual = Array.from(
    { length: completedYears },
    (_value, index) => buildAnnualInstruction(artifact, grammar, index + 1),
  );
  const scheduleInstructions = buildScheduleInstructions(artifact, schedule, asOf, grammar);
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
    const instruction = buildEventInstruction(
      artifact.deterministicSeed,
      event,
      sourceModule,
      asOf,
      grammar,
    );
    if (!instruction) {
      zeroPressureEventIds.push(event.id);
      continue;
    }
    acceptedEventCountByModule[sourceModule] += 1;
    events.push(instruction);
  }

  const growth = [...annual, ...scheduleInstructions, ...events].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
  const emittedColonyIntentCount = growth.reduce(
    (total, instruction) => total + instruction.recruitCount,
    0,
  );

  return {
    growth,
    diagnostics: {
      emptyHistory: events.length === 0 && schedule.days.length === 0,
      excludedEventIds: excludedEventIds.sort(),
      zeroPressureEventIds: zeroPressureEventIds.sort(),
      futureEventIds: futureEventIds.sort(),
      invalidSharedDayOffDates: schedule.invalidDates,
      duplicateSharedDayOffDates: schedule.duplicateDates,
      futureSharedDayOffDates: schedule.futureDates,
      preRelationshipSharedDayOffDates: schedule.preRelationshipDates,
      acceptedEventCountByModule,
      sharedDaysOffCount: schedule.days.length,
      annualInstructionCount: annual.length,
      eventInstructionCount: events.length,
      scheduleInstructionCount: scheduleInstructions.length,
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
  const structure = buildStructure(input.artifact.deterministicSeed);
  const grammar = buildGrammar(input.artifact.deterministicSeed);
  const { growth, diagnostics } = buildGrowth(
    input.artifact,
    asOf,
    state.completedYears,
    grammar,
    schedule,
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
    structure,
    grammar,
    growth,
    diagnostics,
  };
}
