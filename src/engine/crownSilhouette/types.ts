import type { TreeCanopyDepthLayer, TreeCanopyDepthState } from '../canopyDepth';
import type { TreeCanopyLightState } from '../canopyLight';
import type { TreeCompositionState } from '../composition';
import type { GrowthVec3 } from '../growth';
import type { TreeLeafGeometryLod, TreeLeafGeometryState } from '../leafGeometry';
import type { TreeLeafOrientationState } from '../leafOrientation';
import type { TreePhenologyState } from '../phenology';

export interface TreeCrownSilhouetteConfig {
  /** Bump whenever envelope targets, correction bounds or acceptance rules change. */
  rulesVersion: string;
  azimuthSectorCount: number;
  verticalBandCount: number;
  maximumRadialOffsetRatio: number;
  maximumScaleDelta: number;
  envelopeResponse: number;
  middleLayerResponse: number;
  frontClosureSelectionFraction: number;
  frontClosureTargetRadialRatio: number;
  frontClosureMaximumInwardOffsetRatio: number;
  frontClosureScaleDelta: number;
  viewDirectionCount: number;
  minimumReadableFacingDot: number;
  minimumReadableLeafFraction: number;
  /**
   * Скільки листя мусить бути попереду, щоб частку читаного взагалі рахувати.
   *
   * Нижче цього числа напрямок приймається без розмови: не тому, що якість
   * не важлива, а тому, що частки від однієї-шести карток не існує як міри.
   */
  minimumReadableSampleSize: number;
}

export interface TreeCrownSilhouetteProfile {
  id: string;
  leafInstanceId: string;
  canopyDepthProfileId: string;
  canopyLightProfileId: string;
  phenologyProfileId: string;
  leafOrientationProfileId: string;
  sequence: number;
  layer: TreeCanopyDepthLayer;
  crownCellId: string;
  sourcePosition: GrowthVec3;
  renderPosition: GrowthVec3;
  sourceSectorIndex: number;
  renderSectorIndex: number;
  verticalBandIndex: number;
  sourceRadialRatio: number;
  targetEnvelopeRatio: number;
  /**
   * Чи заводила цей листок під оболонку стеля крони (ADR-0108).
   *
   * Відрізняється від `adjusted` тим, що це ІНШИЙ рух: `radialOffsetRatio`
   * тоді не підпорядковується `maximumRadialOffsetRatio`, бо стеля — межа
   * існування, а не дозвіл підсунути.
   */
  ceilingClamped: boolean;
  radialOffset: number;
  radialOffsetRatio: number;
  frontClosureSelected: boolean;
  frontClosureInwardOffsetRatio: number;
  frontClosureScaleDelta: number;
  scaleMultiplier: number;
  envelopeErrorBefore: number;
  envelopeErrorAfter: number;
  adjusted: boolean;
}

export interface TreeCrownViewReadability {
  viewIndex: number;
  direction: GrowthVec3;
  frontLeafCount: number;
  readableFrontLeafCount: number;
  readableFrontLeafFraction: number;
  accepted: boolean;
}

export interface TreeCrownSilhouetteState {
  treeCrownSilhouetteVersion: 1;
  rulesVersion: string;
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceCompositionRulesVersion: string;
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
  sourceLeafOrientationVersion: TreeLeafOrientationState['treeLeafOrientationVersion'];
  sourceLeafOrientationRulesVersion: string;
  sourceLeafOrientationSignature: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  descriptor: {
    id: 'tree:crown-silhouette:polish';
    profileId: 'tree:crown-silhouette:instance-profile';
    matrixAttributeId: 'tree:crown-silhouette:instance-matrix';
    negativeSpaceId: 'tree:crown-silhouette:negative-space';
    sourceGeometryId: 'tree:leaf:instances';
  };
  signature: string;
  profiles: TreeCrownSilhouetteProfile[];
  diagnostics: {
    sourceLeafCount: number;
    emittedProfileCount: number;
    adjustedLeafCount: number;
    adjustedOuterLeafCount: number;
    adjustedMiddleLeafCount: number;
    /** Скільки внутрішніх листків зсунула стеля крони (ADR-0108). */
    adjustedInnerLeafCount: number;
    /** Скільки листків стеля крони завела під оболонку (ADR-0108). */
    ceilingClampedLeafCount: number;
    frontClosureLeafCount: number;
    frontClosureInwardLeafCount: number;
    untouchedInnerLeafCount: number;
    untouchedMiddleLeafCount: number;
    occupiedOuterSectorIndices: number[];
    emptyOuterSectorIndices: number[];
    occupiedOuterSectorCount: number;
    emptyOuterSectorCount: number;
    maximumRadialOffset: number;
    maximumRadialOffsetRatio: number;
    maximumFrontClosureInwardOffsetRatio: number;
    /** Найбільший захід під оболонку, зроблений стелею крони (ADR-0108). */
    maximumCeilingInwardOffsetRatio: number;
    maximumScaleDelta: number;
    averageEnvelopeErrorBefore: number;
    averageEnvelopeErrorAfter: number;
    viewReadability: TreeCrownViewReadability[];
    minimumReadableFrontLeafFraction: number;
    viewReadabilityAccepted: true;
    stableLeafOrderPreserved: true;
    instanceCountPreserved: true;
    crownCellProvenancePreserved: true;
    preservedEmptySectorIndices: true;
    filledPreviouslyEmptySectors: false;
    preservedVerticalBands: true;
    silhouetteErrorNotIncreased: true;
    negativeSpaceAccepted: true;
    estimatedAdditionalDrawCalls: 0;
    estimatedAdditionalMaterials: 0;
    estimatedAdditionalMatrixUpdatesPerFrame: 0;
  };
}

export interface BuildTreeCrownSilhouetteInput {
  composition: TreeCompositionState;
  leaves: TreeLeafGeometryState;
  canopyDepth: TreeCanopyDepthState;
  canopyLight: TreeCanopyLightState;
  phenology: TreePhenologyState;
  leafOrientation: TreeLeafOrientationState;
  config: TreeCrownSilhouetteConfig;
}