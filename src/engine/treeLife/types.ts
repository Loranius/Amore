import type { TreeCompositionState } from '../composition';
import type {
  TreeLeafGeometryLod,
  TreeLeafGeometryState,
} from '../leafGeometry';
import type { TreeSpeciesBlueprint } from '../species/tree';
import type { TreeMaterialState } from '../treeMaterial';

export interface TreeLifeConfig {
  /** Bump whenever sway or flutter formulas change. */
  rulesVersion: string;
  reducedMotion: boolean;
  motionScaleByLod: Readonly<Record<TreeLeafGeometryLod, number>>;
  maxLeafProfiles: number;
}

/** Stable whole-tree sway descriptor. Geometry remains untouched. */
export interface TreeBranchLifeProfile {
  phaseRad: number;
  speed: number;
  swayXAmplitudeRad: number;
  swayZAmplitudeRad: number;
  twistAmplitudeRad: number;
}

/** Stable renderer-independent motion identity for one accepted leaf instance. */
export interface TreeLeafLifeProfile {
  id: string;
  leafInstanceId: string;
  sequence: number;
  phaseRad: number;
  speed: number;
  pitchAmplitudeRad: number;
  rollAmplitudeRad: number;
}

export interface TreeLifeDiagnostics {
  sourceLeafInstanceCount: number;
  emittedLeafProfileCount: number;
  maxLeafProfiles: number;
  truncatedLeafInstanceIds: string[];
  profileBudgetReached: boolean;
  estimatedMatrixUpdatesPerFrame: number;
  estimatedAdditionalDrawCalls: 0;
}

export interface TreeLifeState {
  treeLifeStateVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  reducedMotion: boolean;
  motionScale: number;
  branch: TreeBranchLifeProfile;
  leaves: TreeLeafLifeProfile[];
  diagnostics: TreeLifeDiagnostics;
}

export interface BuildTreeLifeInput {
  species: TreeSpeciesBlueprint;
  composition: TreeCompositionState;
  leaves: TreeLeafGeometryState;
  materials: TreeMaterialState;
  config: TreeLifeConfig;
}

export interface TreeLeafLifeFrame {
  leafInstanceId: string;
  sequence: number;
  pitchRad: number;
  rollRad: number;
}

export interface TreeLifeFrame {
  elapsedSeconds: number;
  branchRotationX: number;
  branchRotationY: number;
  branchRotationZ: number;
  leaves: TreeLeafLifeFrame[];
}

export interface SampleTreeLifeInput {
  life: TreeLifeState;
  elapsedSeconds: number;
  /** Runtime accessibility override; it never mutates TreeLifeState. */
  reducedMotion?: boolean;
}
