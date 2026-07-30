import type { TreeCanopyDepthLayer, TreeCanopyDepthState } from '../canopyDepth';
import type { TreeCanopyLightState } from '../canopyLight';
import type { TreeLeafGeometryLod, TreeLeafGeometryState } from '../leafGeometry';
import type { TreePhenologyState } from '../phenology';

export interface TreeLeafOrientationLayerConfig {
  maximumTiltRad: number;
  maximumFanRad: number;
  maximumTwistRad: number;
}

export interface TreeLeafOrientationConfig {
  /** Bump whenever orientation sampling or bounds change. */
  rulesVersion: string;
  orientationByLayer: Readonly<Record<TreeCanopyDepthLayer, TreeLeafOrientationLayerConfig>>;
  quantizationBands: number;
}

export interface TreeLeafOrientationProfile {
  id: string;
  leafInstanceId: string;
  canopyDepthProfileId: string;
  canopyLightProfileId: string;
  phenologyProfileId: string;
  sequence: number;
  layer: TreeCanopyDepthLayer;
  tiltRad: number;
  fanRad: number;
  twistRad: number;
  totalRotationRad: number;
}

export interface TreeLeafOrientationState {
  treeLeafOrientationVersion: 1;
  rulesVersion: string;
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceLeafGeometryRulesVersion: string;
  sourceCanopyDepthVersion: TreeCanopyDepthState['treeCanopyDepthVersion'];
  sourceCanopyDepthRulesVersion: string;
  sourceCanopyDepthSignature: string;
  sourceCanopyLightVersion: TreeCanopyLightState['treeCanopyLightVersion'];
  sourceCanopyLightRulesVersion: string;
  sourceCanopyLightSignature: string;
  sourcePhenologyVersion: TreePhenologyState['treePhenologyVersion'];
  sourcePhenologyRulesVersion: string;
  sourcePhenologySignature: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  descriptor: {
    id: 'tree:leaf-orientation:micro-variation';
    profileId: 'tree:leaf-orientation:instance-profile';
    matrixAttributeId: 'tree:leaf-orientation:instance-matrix';
    sourceGeometryId: 'tree:leaf:instances';
  };
  signature: string;
  profiles: TreeLeafOrientationProfile[];
  diagnostics: {
    sourceLeafCount: number;
    emittedProfileCount: number;
    innerLeafCount: number;
    middleLeafCount: number;
    outerLeafCount: number;
    nonZeroProfileCount: number;
    minimumRotationRad: number;
    maximumRotationRad: number;
    averageRotationRad: number;
    quantizationBands: number;
    stableLeafOrderPreserved: true;
    instanceCountPreserved: true;
    canopyDepthProvenancePreserved: true;
    canopyLightProvenancePreserved: true;
    phenologyProvenancePreserved: true;
    estimatedAdditionalDrawCalls: 0;
    estimatedAdditionalMaterials: 0;
    estimatedAdditionalMatrixUpdatesPerFrame: 0;
  };
}

export interface BuildTreeLeafOrientationInput {
  leaves: TreeLeafGeometryState;
  canopyDepth: TreeCanopyDepthState;
  canopyLight: TreeCanopyLightState;
  phenology: TreePhenologyState;
  config: TreeLeafOrientationConfig;
}
