import type { TreeCompositionRole, TreeCompositionState } from '../composition';
import type { GrowthVec3 } from '../growth';
import type { OrganicCurveFrameState } from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';

/**
 * Листя сидить на КОЖНІЙ гілці, включно зі стовбуром.
 *
 * Досі стовбур був виключений типом (`Exclude<…, 'trunk'>`), і його верхня
 * частина лишалась голою жердиною, повз яку листя росло тільки збоку.
 * Виміряно: три згустки лягають на висоти 2.85, 3.26 і 3.82 — саме ту
 * ділянку стовбура, що була порожньою (ADR-0075).
 *
 * Стовбур має власний поріг початку (`trunkTerminalStart`): унизу кора,
 * листя лише на молодій верхівці.
 */
export type FoliageBranchRole = TreeCompositionRole;

export interface TreeFoliageConfig {
  /** Bump whenever cluster placement or budget formulas change. */
  rulesVersion: string;
  minimumGeneration: number;
  terminalStart: number;
  /** Той самий поріг, але для стовбура: нижче нього — гола кора. */
  trunkTerminalStart: number;
  maxClusters: number;
  maxLeaves: number;
  minLeavesPerCluster: number;
  maxLeavesPerCluster: number;
  /**
   * Цільова відстань між згустками вздовж гілки, в одиницях сцени.
   *
   * Довга гілка дістає більше згустків, ніж коротка: без цього три згустки
   * розтягувались по двометровій гілці й між ними лишався голий дріт.
   */
  clusterSpacing: number;
  /** Стеля згустків на одній гілці — щоб довга гілка не з'їла весь бюджет. */
  maxClustersPerBranch: number;
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
