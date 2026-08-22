import type { GrowthVec3 } from '../growth';
import type {
  OrganicCurveFrameState,
  OrganicMeshLod,
} from '../labs/organic';
import type { TreeRootArchitectureState } from '../rootArchitecture';
import type { TreeSpeciesBlueprint } from '../species/tree';

export interface TreeGroundContactConfig {
  /** Bump whenever burial, visibility or collar rules change. */
  rulesVersion: string;
  burialDepthBaseRadiusRatio: number;
  minimumBurialDepth: number;
  maximumBurialDepth: number;
  collarHeightBaseRadiusRatio: number;
  collarBottomRadiusRatio: number;
  collarTopRadiusRatio: number;
  collarProfileExponent: number;
  collarRadialSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
}

export interface TreeGroundPlaneDescriptor {
  id: 'tree:ground:contact-plane';
  levelY: number;
  normal: GrowthVec3;
  terrainBindingId: 'tree:terrain:future';
}

export interface TreeGroundContactRootDescriptor {
  rootId: string;
  sourceSampleCount: number;
  visibleSampleCount: number;
  sourcePathLength: number;
  visiblePathLength: number;
  visibleFraction: number;
  buriedSampleIds: string[];
}

export interface TreeTrunkContactCollarDescriptor {
  id: 'tree:ground:trunk-collar';
  center: GrowthVec3;
  bottomY: number;
  topY: number;
  bottomRadius: number;
  topRadius: number;
  ringCount: 7;
  profileExponent: number;
  radialSegmentsByLod: Readonly<Record<OrganicMeshLod, number>>;
}

export interface TreeGroundContactDiagnostics {
  sourceRootCount: number;
  visibleRootCount: number;
  sourceSampleCount: number;
  visibleSampleCount: number;
  buriedSampleCount: number;
  visiblePathFraction: number;
  groundLevelY: number;
  burialDepth: number;
  missingRootCurveIds: string[];
  appendOnlyPrefixPreserved: true;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
}

export interface TreeGroundContactState {
  treeGroundContactVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceRootArchitectureVersion: TreeRootArchitectureState['treeRootArchitectureVersion'];
  sourceRootRulesVersion: string;
  artifactSeed: number;
  ground: TreeGroundPlaneDescriptor;
  burialDepth: number;
  roots: TreeGroundContactRootDescriptor[];
  visibleRootFrames: OrganicCurveFrameState;
  collar: TreeTrunkContactCollarDescriptor;
  diagnostics: TreeGroundContactDiagnostics;
}

export interface BuildTreeGroundContactInput {
  species: TreeSpeciesBlueprint;
  roots: TreeRootArchitectureState;
  config: TreeGroundContactConfig;
}
