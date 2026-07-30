import type { TreeCanopyDepthState } from '../canopyDepth';
import type { GrowthVec3 } from '../growth';
import type { TreeLeafGeometryState, TreeLeafGeometryLod } from '../leafGeometry';
import type { TreeMaterialState, TreeRgb } from '../treeMaterial';

export interface TreeLightResponseConfig {
  rulesVersion: string;
  lightDirection: GrowthVec3;
  ambientFloor: number;
  directStrength: number;
  backlightLift: number;
  quantizationSteps: number;
  maximumUniqueTints: number;
}

export interface TreeLightResponseDescriptor {
  id: 'tree:light-response:canopy';
  profileId: 'tree:light-response:instance-profile';
  tintAttributeId: 'tree:light-response:instance-tint';
  sourceGeometryId: 'tree:leaf:instances';
  materialRole: 'foliage';
}

export interface TreeLightResponseProfile {
  id: string;
  leafInstanceId: string;
  sequence: number;
  exposure: number;
  responseBand: number;
  tintMultiplier: TreeRgb;
}

export interface TreeLightResponseDiagnostics {
  sourceLeafCount: number;
  emittedProfileCount: number;
  minimumExposure: number;
  maximumExposure: number;
  uniqueTintCount: number;
  tintBudget: number;
  tintBudgetExceeded: false;
  quantizationSteps: number;
  stableLeafOrderPreserved: true;
  instanceCountPreserved: true;
  lightDirectionNormalized: true;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
  estimatedAdditionalMatrixUpdatesPerFrame: 0;
}

export interface TreeLightResponseState {
  treeLightResponseVersion: 1;
  rulesVersion: string;
  sourceCanopyDepthVersion: TreeCanopyDepthState['treeCanopyDepthVersion'];
  sourceCanopyDepthRulesVersion: string;
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceLeafGeometryRulesVersion: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  descriptor: TreeLightResponseDescriptor;
  lightDirection: GrowthVec3;
  signature: string;
  profiles: TreeLightResponseProfile[];
  diagnostics: TreeLightResponseDiagnostics;
}

export interface BuildTreeLightResponseInput {
  canopy: TreeCanopyDepthState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  config: TreeLightResponseConfig;
}
