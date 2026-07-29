import type {
  ArtifactBlueprint,
  EvolutionChannel,
  EvolutionPressureVector,
} from '../../evolution';

export const CRYSTAL_LIFE_STAGES = [
  'nucleation',
  'growth',
  'competition',
  'polishing',
  'stabilization',
] as const;

export type CrystalLifeStage = (typeof CRYSTAL_LIFE_STAGES)[number];

export type CrystalFormationKind =
  | 'mother'
  | 'event-spire'
  | 'satellite'
  | 'inclusion';

export type CrystalFormationTier =
  | 'king'
  | 'support'
  | 'family'
  | 'companion'
  | 'micro';

export type CrystalArchetype =
  | 'prismatic'
  | 'massive'
  | 'needle'
  | 'twin'
  | 'blade'
  | 'tabular'
  | 'fan'
  | 'split'
  | 'intergrown'
  | 'etched';

export type LegacyCrystalDomain =
  | 'exploration'
  | 'memory'
  | 'connection'
  | 'creation'
  | 'future';

export interface CrystalSpeciesConfig {
  /** Explicit clock. Species code never reads Date.now(). */
  asOf: string;
  /** Bump whenever species formulas or archetype rules change. */
  rulesVersion: string;
}

export interface CrystalSpeciesPressures {
  expansion: number;
  refinement: number;
  luminosity: number;
  warmth: number;
  stability: number;
  harmony: number;
  brilliance: number;
  surfaceComplexity: number;
  density: number;
  branching: number;
  mutation: number;
  dominantChannel: EvolutionChannel | null;
  dominance: number;
  channelShare: EvolutionPressureVector;
}

export interface CrystalSpeciesState {
  ageDays: number;
  epochCount: number;
  eventCount: number;
  stage: CrystalLifeStage;
  stress: number;
  purity: number;
  cohesion: number;
  energy: number;
  fracture: number;
  density: number;
  luminosity: number;
}

/**
 * A stable species instruction. It describes what should grow and its seeded
 * directional preference, but not an anchor, mesh or Three.js transform.
 * Spatial attachment belongs to the universal Growth Engine.
 */
export interface CrystalGrowthInstruction {
  id: string;
  sourceEventId: string | null;
  sourceEpisodeId: string | null;
  epochIndex: number;
  channel: EvolutionChannel | null;
  kind: CrystalFormationKind;
  tier: CrystalFormationTier;
  archetype: CrystalArchetype;
  emphasized: boolean;
  weight: number;
  maturity: number;
  azimuthRad: number;
  elevation: number;
  radialBias: number;
  attachmentDepth: number;
  seed: number;
}

/** A stable sector that groups formations without mutating their identities. */
export interface CrystalColonyBlueprint {
  id: string;
  epochIndex: number;
  channel: EvolutionChannel;
  seed: number;
  azimuthRad: number;
  elevation: number;
  weight: number;
  instructionIds: string[];
}

export interface CrystalSpeciesDiagnostics {
  emptyHistory: boolean;
  zeroPressureEventIds: string[];
  futureEventIds: string[];
}

export interface CrystalSpeciesBlueprint {
  speciesBlueprintVersion: 1;
  species: 'crystal';
  rulesVersion: string;
  sourceBlueprintVersion: ArtifactBlueprint['blueprintVersion'];
  engineVersion: string;
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  pressures: CrystalSpeciesPressures;
  state: CrystalSpeciesState;
  mother: CrystalGrowthInstruction;
  formations: CrystalGrowthInstruction[];
  colonies: CrystalColonyBlueprint[];
  diagnostics: CrystalSpeciesDiagnostics;
}

export interface BuildCrystalSpeciesBlueprintInput {
  artifact: ArtifactBlueprint;
  config: CrystalSpeciesConfig;
}

/** Structural shape consumed by the current crystal renderer compatibility bridge. */
export interface LegacyCrystalPressureProjection {
  expansion: number;
  refinement: number;
  luminosity: number;
  warmth: number;
  stability: number;
  harmony: number;
  movieMix: number;
  brilliance: number;
  surfaceComplexity: number;
  density: number;
  dominant: LegacyCrystalDomain | null;
  dominance: number;
  domainShare: Record<LegacyCrystalDomain, number>;
}
