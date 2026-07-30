import type {
  TreeCanopyDepthLayer,
  TreeCanopyDepthState,
} from '../canopyDepth';
import type { TreeCompositionState } from '../composition';
import type { GrowthVec3 } from '../growth';
import type {
  TreeLeafGeometryLod,
  TreeLeafGeometryState,
} from '../leafGeometry';
import type { TreeMaterialState, TreeRgb } from '../treeMaterial';

export type TreeCanopyLightBand = 'shade' | 'transition' | 'sunlit';

export interface TreeCanopyLightConfig {
  /** Bump whenever exposure, banding or tint projection rules change. */
  rulesVersion: string;
  lightDirection: GrowthVec3;
  ambientFloor: number;
  sideInfluence: number;
  facingInfluence: number;
  heightInfluence: number;
  layerInfluence: number;
  layerExposureByLayer: Readonly<Record<TreeCanopyDepthLayer, number>>;
  shadowPenaltyByLayer: Readonly<Record<TreeCanopyDepthLayer, number>>;
  shadeMaximum: number;
  sunlitMinimum: number;
  exposureBands: number;
  tintByBand: Readonly<Record<TreeCanopyLightBand, TreeRgb>>;
  quantizationSteps: number;
  maximumUniqueCombinedTints: number;
}

export interface TreeCanopyLightDescriptor {
  id: 'tree:canopy-light:response';
  profileId: 'tree:canopy-light:instance-profile';
  tintAttributeId: 'tree:canopy-light:instance-tint';
  sourceCanopyId: 'tree:canopy-depth:volume';
  materialRole: 'foliage';
}

/** Stable renderer-independent light response for one accepted leaf instance. */
export interface TreeCanopyLightProfile {
  id: string;
  leafInstanceId: string;
  canopyProfileId: string;
  sequence: number;
  canopyLayer: TreeCanopyDepthLayer;
  crownCellId: string;
  surfaceNormal: GrowthVec3;
  crownSideExposure: number;
  surfaceFacingExposure: number;
  normalizedHeight: number;
  layerExposure: number;
  exposure: number;
  band: TreeCanopyLightBand;
  lightTintMultiplier: TreeRgb;
  combinedTintMultiplier: TreeRgb;
}

export interface TreeCanopyLightDiagnostics {
  sourceLeafCount: number;
  emittedProfileCount: number;
  shadeLeafCount: number;
  transitionLeafCount: number;
  sunlitLeafCount: number;
  minimumExposure: number;
  maximumExposure: number;
  averageExposure: number;
  exposureBands: number;
  uniqueCombinedTintCount: number;
  combinedTintBudget: number;
  combinedTintBudgetExceeded: boolean;
  quantizationSteps: number;
  lightDirectionNormalized: boolean;
  canopyProfileOrderPreserved: boolean;
  instanceCountPreserved: boolean;
  crownCellProvenancePreserved: boolean;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
  estimatedAdditionalMatrixUpdatesPerFrame: 0;
}

export interface TreeCanopyLightState {
  treeCanopyLightVersion: 1;
  rulesVersion: string;
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceCompositionRulesVersion: string;
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceLeafGeometryRulesVersion: string;
  sourceCanopyDepthVersion: TreeCanopyDepthState['treeCanopyDepthVersion'];
  sourceCanopyDepthRulesVersion: string;
  sourceCanopyDepthSignature: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  lightDirection: GrowthVec3;
  descriptor: TreeCanopyLightDescriptor;
  signature: string;
  profiles: TreeCanopyLightProfile[];
  diagnostics: TreeCanopyLightDiagnostics;
}

export interface BuildTreeCanopyLightInput {
  composition: TreeCompositionState;
  leaves: TreeLeafGeometryState;
  canopy: TreeCanopyDepthState;
  materials: TreeMaterialState;
  config: TreeCanopyLightConfig;
}
