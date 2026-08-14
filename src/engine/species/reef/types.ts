import type {
  ArtifactBlueprint,
  EvolutionChannel,
  EvolutionPressureVector,
} from '../../evolution';

export const REEF_LIFE_STAGES = [
  'settlement',
  'juvenile',
  'developing',
  'established',
  'ancient',
] as const;

export const REEF_COLONY_MORPHOTYPES = [
  'branching',
  'massive',
  'plating',
  'encrusting',
  'soft-coral',
  'sea-fan',
] as const;

/**
 * Portal modules whose committed facts are allowed to reach Reef Species.
 * This is intentionally an allow-list: new modules cannot alter the reef
 * until their meaning and visual grammar have been reviewed explicitly.
 */
export const REEF_EVENT_SOURCE_MODULES = [
  'calendar',
  'plans',
  'wishlist',
  'map',
  'memories',
  'media',
] as const;

export const REEF_INFLUENCE_SOURCES = [
  'relationship',
  ...REEF_EVENT_SOURCE_MODULES,
  'schedule',
] as const;

export type ReefLifeStage = (typeof REEF_LIFE_STAGES)[number];
export type ReefColonyMorphotype = (typeof REEF_COLONY_MORPHOTYPES)[number];
export type ReefEventSourceModule = (typeof REEF_EVENT_SOURCE_MODULES)[number];
export type ReefInfluenceSource = (typeof REEF_INFLUENCE_SOURCES)[number];

export type ReefModuleEvolutionEntityKind =
  | 'year-arch'
  | 'plan-fish'
  | 'wish-coral'
  | 'photo-coral'
  | 'media-coral'
  | 'map-outcrop'
  | 'calendar-landmark'
  | 'schedule-terrace';

/**
 * One append-only visual fact in the reef history. Geometry adapters may
 * realize the seed differently at each LOD, but the identity never changes.
 */
export interface ReefModuleEvolutionEntity {
  id: string;
  kind: ReefModuleEvolutionEntityKind;
  sourceModule: ReefInfluenceSource;
  sourceEventId: string | null;
  sourceKey: string;
  epochIndex: number;
  sequence: number;
  seed: number;
}

export interface ReefModuleEvolutionFacts {
  daysTogether: number;
  completedYears: number;
  completedPlans: number;
  completedWishes: number;
  photoCount: number;
  finishedMediaCount: number;
  visitedPlaceCount: number;
  calendarLandmarkCount: number;
  sharedDaysOffCount: number;
  sharedDaysOffMonthCount: number;
}

/** Exact history plus the bounded amount rendered simultaneously on mobile. */
export interface ReefModulePopulation {
  logicalCount: number;
  visibleCount: number;
  overflowCount: number;
}

export interface ReefModuleEvolutionFoundation {
  /** Pair-specific seed footprint before the first relationship day. */
  seedRadius: number;
  /** Extra square world units earned by each relationship day. */
  dailySurfaceAreaGain: number;
  /** Chronological area before the long-horizon mobile envelope is applied. */
  chronologicalSurfaceArea: number;
  substrateRadius: number;
  maximumSubstrateRadius: number;
  outerGrowthRadius: number;
  radialSaturation: number;
  /** Legacy renderer projection. Only annual zones whose archetype is arch appear here. */
  arches: ReefModulePopulation;
  /** Legacy renderer projection of clustered map expansion. */
  satelliteOutcrops: ReefModulePopulation;
  /** Kept for renderer compatibility. Schedule no longer creates geometry. */
  scheduleTerraces: ReefModulePopulation;
}

export interface ReefModuleEvolutionColonies {
  primaryWishCorals: ReefModulePopulation;
  /** Logical photos are exact; visible count is clustered annual coverage. */
  microPhotoCorals: ReefModulePopulation;
  /** Logical media is exact; visible count is clustered annual soft-life pools. */
  mediaCorals: ReefModulePopulation;
  calendarLandmarks: ReefModulePopulation;
  /** Separate living bodies must retain this footprint-scaled safety gap. */
  minimumClearanceRatio: number;
}

export interface ReefModuleEvolutionLife {
  planFish: ReefModulePopulation;
}

export interface ReefModuleEvolutionEntities {
  yearArches: ReefModuleEvolutionEntity[];
  planFish: ReefModuleEvolutionEntity[];
  wishCorals: ReefModuleEvolutionEntity[];
  photoCorals: ReefModuleEvolutionEntity[];
  mediaCorals: ReefModuleEvolutionEntity[];
  mapOutcrops: ReefModuleEvolutionEntity[];
  calendarLandmarks: ReefModuleEvolutionEntity[];
  scheduleTerraces: ReefModuleEvolutionEntity[];
}

export const REEF_ANNUAL_STRUCTURE_ARCHETYPES = [
  'core',
  'terrace',
  'ridge',
  'arch',
  'shelf',
  'overhang',
  'buttress',
  'peninsula',
] as const;

export const REEF_SOFT_LIFE_ARCHETYPES = [
  'soft-cluster',
  'sea-fan',
  'anemone',
  'sponge',
  'feather-colony',
] as const;

export type ReefAnnualStructureArchetype = (typeof REEF_ANNUAL_STRUCTURE_ARCHETYPES)[number];
export type ReefSoftLifeArchetype = (typeof REEF_SOFT_LIFE_ARCHETYPES)[number];
export type ReefWishSizeClass = 'low' | 'medium' | 'high';

/**
 * One chronological habitat zone. A relationship year opens territory;
 * activity decides how richly that territory is colonised.
 */
export interface ReefAnnualZone {
  id: string;
  /** Human-readable relationship year: first year = 1. */
  yearIndex: number;
  epochIndex: number;
  complete: boolean;
  /** Discrete 0..1 chronological progress in twelve monthly steps. */
  progress: number;
  growthStage: number;
  activity: number;
  togetherness: number;
  fill: number;
  biodiversity: number;
  colonization: number;
  cohesion: number;
  maturity: number;
  capacity: number;
  usedCapacity: number;
  structureArchetype: ReefAnnualStructureArchetype;
  structureSeed: number;
  eventCount: number;
  moduleCount: number;
  modules: ReefEventSourceModule[];
  photoCount: number;
  wishCount: number;
  planCount: number;
  placeCount: number;
  mediaCount: number;
  anniversaryCount: number;
  milestone: boolean;
  mapExpansion: number;
}

/** Photos become a density field / clustered pioneer-life patch, not one mesh each. */
export interface ReefColonizationPatch {
  id: string;
  yearIndex: number;
  epochIndex: number;
  photoCount: number;
  contribution: number;
  density: number;
  seed: number;
}

/** A fulfilled wish retains one stable hard-coral identity. */
export interface ReefHardCoralIdentity {
  id: string;
  sourceEventId: string;
  yearIndex: number;
  epochIndex: number;
  occurredAtEpochMs: number;
  maturity: number;
  importance: number;
  sizeClass: ReefWishSizeClass;
  maximumScale: number;
  growth: number;
  seed: number;
}

/** A completed plan retains one stable fish identity even when not simultaneously rendered. */
export interface ReefFishIdentity {
  id: string;
  sourceEventId: string;
  yearIndex: number;
  epochIndex: number;
  occurredAtEpochMs: number;
  seed: number;
}

/** Finished media expands a bounded soft-life vocabulary per annual zone. */
export interface ReefSoftLifePool {
  id: string;
  yearIndex: number;
  epochIndex: number;
  itemCount: number;
  diversity: number;
  density: number;
  unlockedArchetypes: ReefSoftLifeArchetype[];
  seed: number;
}

export interface ReefEcologyState {
  /** Chronological habitat footprint: time controls scale, never event volume. */
  foundationScale: number;
  /** Horizontal reach: age baseline plus exploration from visited places. */
  foundationSpread: number;
  structuralComplexity: number;
  colonization: number;
  biodiversity: number;
  cohesion: number;
  maturity: number;
  habitatCapacity: number;
  usedCapacity: number;
  logicalFishPopulation: number;
  visibleFishPopulation: number;
}

/**
 * Source of truth for Reef Species development. Legacy entity arrays below are
 * only a compatibility projection for the current renderer during migration.
 */
export interface ReefDevelopmentModel {
  annualZones: ReefAnnualZone[];
  colonizationPatches: ReefColonizationPatch[];
  hardCorals: ReefHardCoralIdentity[];
  fishPopulation: ReefFishIdentity[];
  softLifePools: ReefSoftLifePool[];
  ecology: ReefEcologyState;
}

/**
 * Reef-only projection of portal history. Crystal and Tree never consume it.
 */
export interface ReefModuleEvolutionPlan {
  version: 'reef-module-evolution-v1';
  identitySeed: number;
  facts: ReefModuleEvolutionFacts;
  /** New ecological source of truth. */
  development: ReefDevelopmentModel;
  foundation: ReefModuleEvolutionFoundation;
  colonies: ReefModuleEvolutionColonies;
  life: ReefModuleEvolutionLife;
  /** Compatibility projection consumed by the current renderer. */
  entities: ReefModuleEvolutionEntities;
}

export type ReefColonyRole =
  | 'foundation'
  | 'framework'
  | 'memory'
  | 'frontier'
  | 'ornamental'
  | 'landmark';

export type ReefColonyTier = 'anchor' | 'primary' | 'companion' | 'micro';

export interface ReefSpeciesConfig {
  /** Explicit clock. Reef Species never reads Date.now(). */
  asOf: string;
  /** Bump whenever Reef Species translation or grammar rules change. */
  rulesVersion: string;
  /**
   * Past days both partners marked as days off in Schedule.
   *
   * These are lived calendar facts, not portal events, so they strengthen
   * substrate and resilience without inflating event/channel pressure.
   */
  sharedDaysOff?: readonly string[];
}

export interface ReefSpeciesPressures {
  substrateCoverage: number;
  verticalComplexity: number;
  branchPotential: number;
  platePotential: number;
  encrustingPotential: number;
  softCoralPotential: number;
  resilience: number;
  diversity: number;
  currentBias: number;
  dominantChannel: EvolutionChannel | null;
  dominance: number;
  channelShare: EvolutionPressureVector;
}

export interface ReefSpeciesState {
  ageDays: number;
  completedYears: number;
  epochCount: number;
  eventCount: number;
  sharedDaysOffCount: number;
  stage: ReefLifeStage;
  substrateMaturity: number;
  colonyMaturity: number;
  biodiversityMaturity: number;
}

/** Stable substrate and water-current baseline derived only from artifact DNA. */
export interface ReefStructureInstruction {
  id: 'reef:structure';
  seed: number;
  substrateRadius: number;
  reefHeight: number;
  shelfCount: number;
  colonySpacing: number;
  verticalRelief: number;
  slopeBias: number;
  currentDirectionRad: number;
  currentStrength: number;
}

/**
 * Stable rules used by later colony-layout and geometry adapters. This phase
 * publishes no positions, meshes, materials or renderer state.
 */
export interface ReefGrowthGrammar {
  id: 'reef:growth-grammar';
  seed: number;
  radialBandCount: number;
  verticalBandCount: number;
  minimumSpacingRatio: number;
  annualRecruitmentCount: number;
  maximumAcceptedColonies: number;
  morphotypeOrder: readonly ReefColonyMorphotype[];
}

/** Species-specific colony intent without coordinates or geometry. */
export interface ReefGrowthInstruction {
  id: string;
  sourceModule: ReefInfluenceSource;
  sourceEventId: string | null;
  sourceEpisodeId: string | null;
  epochIndex: number;
  /** Stable chronological key used by append-only colony-layout adapters. */
  sequence: number;
  channel: EvolutionChannel | null;
  morphotype: ReefColonyMorphotype;
  role: ReefColonyRole;
  tier: ReefColonyTier;
  emphasized: boolean;
  weight: number;
  maturity: number;
  preferredAzimuthRad: number;
  radialBand: number;
  verticalBand: number;
  footprint: number;
  heightBias: number;
  branchingBias: number;
  recruitCount: number;
  seed: number;
}

export interface ReefSpeciesDiagnostics {
  emptyHistory: boolean;
  /** Events rejected by the reef-specific source allow-list. */
  excludedEventIds: string[];
  zeroPressureEventIds: string[];
  futureEventIds: string[];
  invalidSharedDayOffDates: string[];
  duplicateSharedDayOffDates: string[];
  futureSharedDayOffDates: string[];
  preRelationshipSharedDayOffDates: string[];
  acceptedEventCountByModule: Record<ReefEventSourceModule, number>;
  sharedDaysOffCount: number;
  annualInstructionCount: number;
  eventInstructionCount: number;
  scheduleInstructionCount: number;
  emittedColonyIntentCount: number;
  maximumAcceptedColonies: number;
  colonyBudgetExceeded: boolean;
}

export interface ReefSpeciesBlueprint {
  speciesBlueprintVersion: 1;
  species: 'reef';
  rulesVersion: string;
  sourceBlueprintVersion: ArtifactBlueprint['blueprintVersion'];
  engineVersion: string;
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  pressures: ReefSpeciesPressures;
  state: ReefSpeciesState;
  moduleEvolution: ReefModuleEvolutionPlan;
  structure: ReefStructureInstruction;
  grammar: ReefGrowthGrammar;
  growth: ReefGrowthInstruction[];
  diagnostics: ReefSpeciesDiagnostics;
}

export interface BuildReefSpeciesBlueprintInput {
  artifact: ArtifactBlueprint;
  config: ReefSpeciesConfig;
}
