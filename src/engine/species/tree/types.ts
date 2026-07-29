import type {
  ArtifactBlueprint,
  EvolutionChannel,
  EvolutionPressureVector,
} from '../../evolution';

export const TREE_LIFE_STAGES = [
  'sapling',
  'young',
  'established',
  'mature',
  'ancient',
] as const;

export type TreeLifeStage = (typeof TREE_LIFE_STAGES)[number];

export type TreeBranchKind =
  | 'annual-bough'
  | 'crown'
  | 'memory'
  | 'explorer'
  | 'ornamental'
  | 'support'
  | 'landmark';

export type TreeBranchTier = 'support' | 'family' | 'companion' | 'micro';

export interface TreeSpeciesConfig {
  /** Explicit clock. Tree Species never reads Date.now(). */
  asOf: string;
  /** Bump whenever tree translation formulas change. */
  rulesVersion: string;
}

export interface TreeSpeciesPressures {
  trunkExpansion: number;
  branchEnergy: number;
  crownSpread: number;
  foliagePotential: number;
  rootStability: number;
  asymmetry: number;
  memoryDensity: number;
  dominantChannel: EvolutionChannel | null;
  dominance: number;
  channelShare: EvolutionPressureVector;
}

export interface TreeSpeciesState {
  ageDays: number;
  completedYears: number;
  epochCount: number;
  eventCount: number;
  stage: TreeLifeStage;
  trunkMaturity: number;
  canopyMaturity: number;
  foliageMaturity: number;
}

/** Stable baseline shape. It depends on artifact DNA, never on later events. */
export interface TreeStructureInstruction {
  id: 'tree:structure';
  seed: number;
  trunkHeight: number;
  trunkStep: number;
  branchStep: number;
  crownRadius: number;
  crownHeight: number;
  baseRadius: number;
  radiusDecay: number;
  upwardBias: number;
  directionMemory: number;
  lateralJitter: number;
}

/**
 * Species-specific branch intent. It contains no coordinates, mesh or Three.js
 * state. The organic Growth adapter decides the actual attractor positions.
 */
export interface TreeGrowthInstruction {
  id: string;
  sourceEventId: string | null;
  sourceEpisodeId: string | null;
  epochIndex: number;
  /** Stable chronological key used by append-only Growth adapters. */
  sequence: number;
  channel: EvolutionChannel | null;
  kind: TreeBranchKind;
  tier: TreeBranchTier;
  emphasized: boolean;
  weight: number;
  maturity: number;
  preferredAzimuthRad: number;
  preferredElevation: number;
  radialBias: number;
  crownLayer: number;
  attractorCount: number;
  seed: number;
}

export interface TreeSpeciesDiagnostics {
  emptyHistory: boolean;
  zeroPressureEventIds: string[];
  futureEventIds: string[];
  annualInstructionCount: number;
  eventInstructionCount: number;
}

export interface TreeSpeciesBlueprint {
  speciesBlueprintVersion: 1;
  species: 'tree';
  rulesVersion: string;
  sourceBlueprintVersion: ArtifactBlueprint['blueprintVersion'];
  engineVersion: string;
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  pressures: TreeSpeciesPressures;
  state: TreeSpeciesState;
  structure: TreeStructureInstruction;
  growth: TreeGrowthInstruction[];
  diagnostics: TreeSpeciesDiagnostics;
}

export interface BuildTreeSpeciesBlueprintInput {
  artifact: ArtifactBlueprint;
  config: TreeSpeciesConfig;
}
