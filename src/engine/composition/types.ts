import type { GrowthState, GrowthTier, GrowthVec3 } from '../growth';
import type {
  OrganicCurveFrameState,
  OrganicSkeletonState,
} from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';

export type CrystalSilhouette = 'cathedral' | 'fan' | 'druse';
export type CrystalCompositionRole = 'focal' | 'support' | 'family' | 'companion' | 'micro';

export interface CrystalCompositionConfig {
  /** Bump whenever scoring or silhouette classification rules change. */
  rulesVersion: string;
  sectorCount: number;
  targetEmptySectorShare: number;
}

export interface CrystalCompositionBody {
  id: string;
  sourceBodyId: string;
  tier: GrowthTier;
  role: CrystalCompositionRole;
  focal: boolean;
  protected: boolean;
  decorative: boolean;
  volume: number;
  height: number;
  radialDistance: number;
  sectorIndex: number;
  anchor: GrowthVec3;
  direction: GrowthVec3;
}

export interface CrystalCompositionScore {
  hierarchy: number;
  flow: number;
  silhouette: number;
  density: number;
  balance: number;
  rhythm: number;
  negativeSpace: number;
  realism: number;
  total: number;
}

export interface CrystalCompositionDiagnostics {
  orphanBodyIds: string[];
  duplicateFocalBodyIds: string[];
  emptySectorIndices: number[];
  crowdedSectorIndices: number[];
}

export interface CrystalCompositionState {
  compositionStateVersion: 1;
  rulesVersion: string;
  sourceGrowthStateVersion: GrowthState['growthStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  silhouette: CrystalSilhouette;
  axis: GrowthVec3;
  bodies: CrystalCompositionBody[];
  score: CrystalCompositionScore;
  diagnostics: CrystalCompositionDiagnostics;
}

export interface BuildCrystalCompositionInput {
  growth: GrowthState;
  config: CrystalCompositionConfig;
}

export type TreeSilhouette = 'columnar' | 'oval' | 'umbrella' | 'windswept';
export type TreeCompositionRole = 'trunk' | 'primary' | 'secondary' | 'twig';

export interface TreeCompositionConfig {
  /** Bump whenever tree scoring or silhouette rules change. */
  rulesVersion: string;
  azimuthSectorCount: number;
  verticalLayerCount: number;
  targetEmptySectorShare: number;
  targetCrownFill: number;
}

export interface TreeCompositionBounds {
  min: GrowthVec3;
  max: GrowthVec3;
  center: GrowthVec3;
  radius: number;
  height: number;
}

/** Stable branch-local analysis. It never mutates the source skeleton or frames. */
export interface TreeCompositionBranch {
  branchId: string;
  generation: number;
  role: TreeCompositionRole;
  parentBranchId: string | null;
  sourceNodeCount: number;
  sampleCount: number;
  length: number;
  meanRadius: number;
  estimatedVolume: number;
  radialReach: number;
  minHeight: number;
  maxHeight: number;
  azimuthSectorIndex: number;
  verticalLayerIndices: number[];
  terminalDirection: GrowthVec3;
}

export interface TreeCompositionScore {
  hierarchy: number;
  flow: number;
  silhouette: number;
  crownDensity: number;
  balance: number;
  rhythm: number;
  negativeSpace: number;
  junctionRealism: number;
  total: number;
}

export interface TreeCompositionDiagnostics {
  missingCurveBranchIds: string[];
  orphanCurveBranchIds: string[];
  emptySectorIndices: number[];
  crowdedSectorIndices: number[];
  occupiedCellCount: number;
  emptyCellCount: number;
  generationCounts: number[];
}

export interface TreeCompositionState {
  treeCompositionVersion: 1;
  rulesVersion: string;
  sourceSpeciesRulesVersion: string;
  sourceSkeletonVersion: OrganicSkeletonState['organicSkeletonVersion'];
  sourceFrameVersion: OrganicCurveFrameState['organicCurveFrameVersion'];
  artifactSeed: number;
  silhouette: TreeSilhouette;
  axis: GrowthVec3;
  /**
   * Основа стовбура — точка, крізь яку проходить вісь.
   *
   * Вісь публікувалась і без неї, тобто НАПРЯМОК був, а ПРЯМОЇ не було: щоб
   * поміряти відстань від осі, потрібні обидва. Композиція сама рахувала це
   * всередині (`crownMetrics`), а споживачам лишався центр габаритної
   * коробки — а він у дерева з несиметричною кроною відходить від стовбура
   * на десяту частину зросту (виміряно на сорока роках: 0.53 при висоті
   * 5.04). Огинальна крони — тіло обертання довкола СТОВБУРА, і міряти її
   * від центра коробки означало міряти не те (ADR-0109).
   */
  base: GrowthVec3;
  bounds: TreeCompositionBounds;
  branches: TreeCompositionBranch[];
  score: TreeCompositionScore;
  diagnostics: TreeCompositionDiagnostics;
}

export interface BuildTreeCompositionInput {
  species: TreeSpeciesBlueprint;
  skeleton: OrganicSkeletonState;
  frames: OrganicCurveFrameState;
  config: TreeCompositionConfig;
}
