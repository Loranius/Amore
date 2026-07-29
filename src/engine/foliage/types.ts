import type { TreeCompositionRole, TreeCompositionState } from '../composition';
import type { GrowthVec3 } from '../growth';
import type { OrganicCurveFrameState } from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';

export type FoliageBranchRole = Exclude<TreeCompositionRole, 'trunk'>;

export interface TreeFoliageConfig {
  /** Bump whenever cluster placement or budget formulas change. */
  rulesVersion: string;
  minimumGeneration: number;
  terminalStart: number;
  maxClusters: number;
  maxLeaves: number;
  minLeavesPerCluster: number;
  maxLeavesPerCluster: number;
  minClusterRadius: number;
  maxClusterRadius: number;
  clustersByRole: Readonly<Record<FoliageBranchRole, number>>;
}

/** Stable renderer-independent canopy cluster. */
export interface TreeFoliageCluster {
  id: string;
  branchId: string;
  sourceSampleId: string;
  generation: number;
  role: FoliageBranchRole;
  sequence: number;
  seed: number;
  position: GrowthVec3;
  direction: GrowthVec3;
  normal: GrowthVec3;
  radius: number;
  density: number;
  leafCount: number;
  azimuthSectorIndex: number;
  verticalLayerIndex: number;
  crownCellId: string;
}

export interface TreeFoliageDiagnostics {
  candidateClusterCount: number;
  emittedClusterCount: number;
  totalLeafCount: number;
  occupiedCellIds: string[];
  truncatedClusterIds: string[];
  branchIdsWithoutFoliage: string[];
  maxClusterBudgetReached: boolean;
  maxLeafBudgetReached: boolean;
}

export interface TreeFoliageState {
  treeFoliageVersion: 1;
  rulesVersion: string;
  sourceSpeciesRulesVersion: string;
  sourceFrameVersion: OrganicCurveFrameState['organicCurveFrameVersion'];
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  artifactSeed: number;
  clusters: TreeFoliageCluster[];
  diagnostics: TreeFoliageDiagnostics;
}

export interface BuildTreeFoliageInput {
  species: TreeSpeciesBlueprint;
  frames: OrganicCurveFrameState;
  composition: TreeCompositionState;
  config: TreeFoliageConfig;
}
