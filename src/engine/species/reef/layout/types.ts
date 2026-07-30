import type {
  ReefColonyMorphotype,
  ReefColonyRole,
  ReefColonyTier,
  ReefSpeciesBlueprint,
} from '../types';

export interface ReefLayoutVec3 {
  x: number;
  y: number;
  z: number;
}

export interface ReefColonyLayoutConfig {
  /** Bump whenever substrate sampling, occupancy or collision rules change. */
  rulesVersion: string;
  azimuthSectorCount: number;
  maximumAttemptsPerColony: number;
  maximumColoniesPerCell: number;
  minimumClearanceRatio: number;
  surfaceNormalStepRatio: number;
  radialPaddingRatio: number;
}

/** Stable logical substrate cell. It is not renderer geometry. */
export interface ReefSubstrateCell {
  id: string;
  radialBand: number;
  azimuthSectorIndex: number;
  radialStart: number;
  radialEnd: number;
  center: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  currentExposure: number;
  capacity: number;
  occupiedColonyIds: string[];
}

/** Stable colony anchor consumed by later reef geometry adapters. */
export interface ReefColonyPlacement {
  id: string;
  sourceInstructionId: string;
  sourceEventId: string | null;
  sourceEpisodeId: string | null;
  sequence: number;
  recruitIndex: number;
  seed: number;
  morphotype: ReefColonyMorphotype;
  role: ReefColonyRole;
  tier: ReefColonyTier;
  emphasized: boolean;
  weight: number;
  maturity: number;
  footprintIntent: number;
  heightBias: number;
  branchingBias: number;
  substrateCellId: string;
  radialBand: number;
  verticalBand: number;
  azimuthSectorIndex: number;
  azimuthRad: number;
  radialDistance: number;
  position: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  facingRad: number;
  footprintRadius: number;
  targetHeight: number;
  currentExposure: number;
}

export interface ReefColonyLayoutDiagnostics {
  sourceInstructionCount: number;
  candidateColonyCount: number;
  acceptedColonyCount: number;
  rejectedColonyIds: string[];
  truncatedColonyIds: string[];
  truncatedInstructionIds: string[];
  instructionIdsWithoutAcceptedColonies: string[];
  occupiedCellIds: string[];
  crowdedCellIds: string[];
  collisionRejectionCount: number;
  cellCapacityRejectionCount: number;
  maximumAcceptedColonies: number;
  maximumAttemptsPerColony: number;
  colonyBudgetReached: boolean;
  minimumAcceptedClearance: number | null;
}

export interface ReefColonyLayoutState {
  reefColonyLayoutVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:colony-layout';
    substrateId: 'reef:substrate-occupancy';
    colonyId: 'reef:colony-anchor';
  };
  sourceSpeciesBlueprintVersion: ReefSpeciesBlueprint['speciesBlueprintVersion'];
  sourceSpeciesRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  cells: ReefSubstrateCell[];
  colonies: ReefColonyPlacement[];
  diagnostics: ReefColonyLayoutDiagnostics;
}

export interface BuildReefColonyLayoutInput {
  species: ReefSpeciesBlueprint;
  config?: ReefColonyLayoutConfig;
}
