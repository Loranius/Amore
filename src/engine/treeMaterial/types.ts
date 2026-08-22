import type { TreeCompositionState } from '../composition';
import type { TreeFoliageState } from '../foliage';
import type { TreeLeafGeometryState } from '../leafGeometry';
import type { TreeSpeciesBlueprint } from '../species/tree';

export type TreeMaterialRole = 'bark' | 'foliage';

export interface TreeRgb {
  r: number;
  g: number;
  b: number;
}

export interface TreeMaterialConfig {
  /** Bump whenever palette or surface formulas change. */
  rulesVersion: string;
  /** Number of published values available per RGB channel. */
  quantizationSteps: number;
  /** Tree Lab is intentionally limited to bark + foliage. */
  maxMaterials: 2;
}

export interface TreeMaterialRecipe {
  treeMaterialVersion: 1;
  id: string;
  role: TreeMaterialRole;
  signature: string;
  color: TreeRgb;
  roughness: number;
  metalness: 0;
  emissiveColor: TreeRgb;
  emissiveIntensity: number;
  opacity: 1;
  transparent: false;
  depthWrite: true;
  flatShading: boolean;
  side: 'front' | 'double';
}

export interface TreeMaterialPalette {
  bark: TreeRgb;
  foliage: TreeRgb;
}

export interface TreeMaterialBindings {
  branchMaterialId: string;
  leafMaterialId: string;
}

export interface TreeMaterialDiagnostics {
  uniqueMaterialCount: number;
  materialBudget: 2;
  materialBudgetExceeded: false;
  quantizationSteps: number;
  clampedRoles: TreeMaterialRole[];
  duplicateRoleIds: string[];
}

export interface TreeMaterialState {
  treeMaterialStateVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionVersion: TreeCompositionState['treeCompositionVersion'];
  sourceFoliageVersion: TreeFoliageState['treeFoliageVersion'];
  sourceLeafGeometryVersion: TreeLeafGeometryState['treeLeafGeometryVersion'];
  artifactSeed: number;
  palette: TreeMaterialPalette;
  materials: TreeMaterialRecipe[];
  bindings: TreeMaterialBindings;
  diagnostics: TreeMaterialDiagnostics;
}

export interface BuildTreeMaterialInput {
  species: TreeSpeciesBlueprint;
  composition: TreeCompositionState;
  foliage: TreeFoliageState;
  leaves: TreeLeafGeometryState;
  config: TreeMaterialConfig;
}
