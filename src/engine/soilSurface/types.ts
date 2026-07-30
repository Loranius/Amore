import type { OrganicMeshLod } from '../labs/organic';
import type { TreeRootGeometryState } from '../rootGeometry';
import type { TreeSpeciesBlueprint } from '../species/tree';
import type { TreeTerrainBindingState } from '../terrainBinding';
import type { TreeMaterialState, TreeRgb } from '../treeMaterial';

export interface TreeSoilSurfaceConfig {
  /** Bump whenever soil tint, variation or tint budgets change. */
  rulesVersion: string;
  /** Number of published values available per RGB multiplier channel. */
  quantizationSteps: number;
  maximumUniqueTints: number;
  radialTintBands: number;
  variationTintBands: number;
  plateauTint: TreeRgb;
  reliefTint: TreeRgb;
  edgeTint: TreeRgb;
  radialVariationStrength: number;
  heightVariationStrength: number;
}

export interface TreeSoilSurfaceDescriptor {
  id: 'tree:soil:surface';
  paletteId: 'tree:soil:palette';
  tintAttributeId: 'tree:soil:vertex-tint';
  terrainSurfaceId: 'tree:terrain:surface';
  materialRole: 'bark';
}

export interface TreeSoilSurfacePalette {
  plateau: TreeRgb;
  relief: TreeRgb;
  edge: TreeRgb;
}

export interface TreeSoilSurfaceDiagnostics {
  rootGeometryVertexCount: number;
  preservedBarkVertexCount: number;
  terrainVertexOffset: number;
  terrainVertexCount: number;
  tintedTerrainVertexCount: number;
  uniqueTintCount: number;
  tintBudget: number;
  tintBudgetExceeded: false;
  quantizationSteps: number;
  radialTintBands: number;
  variationTintBands: number;
  prefixWhitePreserved: true;
  terrainRangePreserved: true;
  materialRole: 'bark';
  materialCount: 2;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
}

export interface TreeSoilSurfaceState {
  treeSoilSurfaceVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceTerrainBindingVersion: TreeTerrainBindingState['treeTerrainBindingVersion'];
  sourceTerrainBindingRulesVersion: string;
  sourceRootGeometryVersion: TreeRootGeometryState['treeRootGeometryVersion'];
  sourceRootGeometryRulesVersion: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  descriptor: TreeSoilSurfaceDescriptor;
  palette: TreeSoilSurfacePalette;
  signature: string;
  /** RGB multipliers for every vertex in the merged static root/collar/terrain mesh. */
  vertexColors: number[];
  diagnostics: TreeSoilSurfaceDiagnostics;
}

export interface BuildTreeSoilSurfaceInput {
  species: TreeSpeciesBlueprint;
  terrain: TreeTerrainBindingState;
  rootGeometry: TreeRootGeometryState;
  materials: TreeMaterialState;
  config: TreeSoilSurfaceConfig;
}
