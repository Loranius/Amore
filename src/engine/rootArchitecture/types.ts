import type { TreeCompositionState } from '../composition';
import type { GrowthVec3 } from '../growth';
import type { OrganicCurveFrameState } from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';

export type TreeRootKind = 'surface' | 'near-surface';

export interface TreeRootArchitectureConfig {
  /** Bump whenever root count, placement or canonical sampling changes. */
  rulesVersion: string;
  minimumRoots: number;
  maximumRoots: number;
  samplesPerRoot: number;
  maximumSamples: number;
}

export interface TreeRootDescriptor {
  id: string;
  sequence: number;
  kind: TreeRootKind;
  azimuthRad: number;
  bendRad: number;
  length: number;
  maximumDepth: number;
  startRadius: number;
  endRadius: number;
  startPosition: GrowthVec3;
  terminalPosition: GrowthVec3;
  sampleIds: string[];
}

export interface TreeRootArchitectureDiagnostics {
  missingTrunkBase: boolean;
  candidateRootCount: number;
  emittedRootCount: number;
  surfaceRootCount: number;
  nearSurfaceRootCount: number;
  sampleCount: number;
  rootBudget: number;
  sampleBudget: number;
  truncatedRootIds: string[];
}

export interface TreeRootArchitectureState {
  treeRootArchitectureVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceFrameVersion: OrganicCurveFrameState['organicCurveFrameVersion'];
  artifactSeed: number;
  roots: TreeRootDescriptor[];
  frames: OrganicCurveFrameState;
  diagnostics: TreeRootArchitectureDiagnostics;
}

export interface BuildTreeRootArchitectureInput {
  species: TreeSpeciesBlueprint;
  composition: TreeCompositionState;
  frames: OrganicCurveFrameState;
  config: TreeRootArchitectureConfig;
}
