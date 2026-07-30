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

export type ReefLifeStage = (typeof REEF_LIFE_STAGES)[number];
export type ReefColonyMorphotype = (typeof REEF_COLONY_MORPHOTYPES)[number];

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
  zeroPressureEventIds: string[];
  futureEventIds: string[];
  annualInstructionCount: number;
  eventInstructionCount: number;
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
  structure: ReefStructureInstruction;
  grammar: ReefGrowthGrammar;
  growth: ReefGrowthInstruction[];
  diagnostics: ReefSpeciesDiagnostics;
}

export interface BuildReefSpeciesBlueprintInput {
  artifact: ArtifactBlueprint;
  config: ReefSpeciesConfig;
}
