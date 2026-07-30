import type { TreeCanopyLightState } from '../canopyLight';
import type { TreeLeafGeometryLod, TreeLeafGeometryState } from '../leafGeometry';
import type { TreeSpeciesBlueprint } from '../species/tree';
import type { TreeMaterialState, TreeRgb } from '../treeMaterial';

export type TreePhenologyPhase = 'spring' | 'summer' | 'autumn' | 'winter';
export type TreePhenologyRole = 'base' | 'accent';

export interface TreePhenologyConfig {
  rulesVersion: string;
  accentShareByPhase: Readonly<Record<TreePhenologyPhase, number>>;
  tintByPhase: Readonly<Record<TreePhenologyPhase, TreeRgb>>;
  quantizationSteps: number;
  maximumUniqueCombinedTints: number;
}

export interface TreePhenologyProfile {
  id: string;
  leafInstanceId: string;
  canopyLightProfileId: string;
  sequence: number;
  role: TreePhenologyRole;
  accentStrength: number;
  phenologyTintMultiplier: TreeRgb;
  combinedTintMultiplier: TreeRgb;
}

export interface TreePhenologyState {
  treePhenologyVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  sourceLeafGeometryRulesVersion: string;
  sourceCanopyLightVersion: TreeCanopyLightState['treeCanopyLightVersion'];
  sourceCanopyLightRulesVersion: string;
  sourceCanopyLightSignature: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  asOf: string;
  phase: TreePhenologyPhase;
  descriptor: {
    id: 'tree:phenology:seasonal-accent';
    profileId: 'tree:phenology:instance-profile';
    tintAttributeId: 'tree:phenology:instance-tint';
    sourceCanopyLightId: 'tree:canopy-light:response';
    materialRole: 'foliage';
  };
  signature: string;
  profiles: TreePhenologyProfile[];
  diagnostics: {
    sourceLeafCount: number;
    emittedProfileCount: number;
    baseLeafCount: number;
    accentLeafCount: number;
    accentShare: number;
    uniqueCombinedTintCount: number;
    combinedTintBudget: number;
    combinedTintBudgetExceeded: false;
    stableLeafOrderPreserved: true;
    instanceCountPreserved: true;
    estimatedAdditionalDrawCalls: 0;
    estimatedAdditionalMaterials: 0;
    estimatedAdditionalMatrixUpdatesPerFrame: 0;
  };
}

export interface BuildTreePhenologyInput {
  species: TreeSpeciesBlueprint;
  leaves: TreeLeafGeometryState;
  canopyLight: TreeCanopyLightState;
  materials: TreeMaterialState;
  asOf: string;
  config: TreePhenologyConfig;
}
