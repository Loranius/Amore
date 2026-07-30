import type { TreeCompositionState } from '../composition';
import type { TreeFoliageState } from '../foliage';
import type { GrowthVec3 } from '../growth';
import type { TreeLeafGeometryState, TreeLeafGeometryLod } from '../leafGeometry';
import type { TreeMaterialState, TreeRgb } from '../treeMaterial';

export type TreeCanopyDepthLayer = 'inner' | 'middle' | 'outer';

export interface TreeCanopyDepthConfig {
  /** Bump whenever depth classification, transforms or tint budgets change. */
  rulesVersion: string;
  innerDepthMaximum: number;
  outerDepthMinimum: number;
  maximumOffsetRatio: number;
  scaleByLayer: Readonly<Record<TreeCanopyDepthLayer, number>>;
  tintByLayer: Readonly<Record<TreeCanopyDepthLayer, TreeRgb>>;
  quantizationSteps: number;
  maximumUniqueTints: number;
}

export interface TreeCanopyDepthDescriptor {
  id: 'tree:canopy-depth:volume';
  profileId: 'tree:canopy-depth:instance-profile';
  tintAttributeId: 'tree:canopy-depth:instance-tint';
  sourceGeometryId: 'tree:leaf:instances';
  materialRole: 'foliage';
}

/** Renderer-independent visual projection for one accepted leaf instance. */
export interface TreeCanopyDepthProfile {
  id: string;
  leafInstanceId: string;
  clusterId: string;
  branchId: string;
  sequence: number;
  layer: TreeCanopyDepthLayer;
  depth: number;
  crownCellId: string;
  sourcePosition: GrowthVec3;
  positionOffset: GrowthVec3;
  renderPosition: GrowthVec3;
  scaleMultiplier: number;
  tintMultiplier: TreeRgb;
}

export interface TreeCanopyDepthDiagnostics {
  sourceLeafCount: number;
  emittedProfileCount: number;
  innerLeafCount: number;
  middleLeafCount: number;
  outerLeafCount: number;
  occupiedCellCount: number;
  preservedOccupiedCellIds: true;
  filledPreviouslyEmptyCells: false;
  stableLeafOrderPreserved: true;
  instanceCountPreserved: true;
  minimumScaleMultiplier: number;
  maximumScaleMultiplier: number;
  maximumPositionOffset: number;
  maximumPositionOffsetRatio: number;
  uniqueTintCount: number;
  tintBudget: number;
  tintBudgetExceeded: false;
  quantizationSteps: number;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
  estimatedAdditionalMatrixUpdatesPerFrame: 0;
}

export interface TreeCanopyDepthState {
  treeCanopyDepthVersion: 1;
  rulesVersion: string;
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceCompositionRulesVersion: string;
  sourceFoliageVersion: TreeFoliageState['treeFoliageVersion'];
  sourceFoliageRulesVersion: string;
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceLeafGeometryRulesVersion: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  descriptor: TreeCanopyDepthDescriptor;
  signature: string;
  profiles: TreeCanopyDepthProfile[];
  diagnostics: TreeCanopyDepthDiagnostics;
}

export interface BuildTreeCanopyDepthInput {
  composition: TreeCompositionState;
  foliage: TreeFoliageState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  config: TreeCanopyDepthConfig;
}
