import type {
  OrganicCurveFrameState,
  OrganicMeshLod,
  OrganicSweepMesh,
} from '../labs/organic';
import type { TreeRootGeometryState } from '../rootGeometry';
import type { TreeSoilSurfaceState } from '../soilSurface';
import type { TreeSpeciesBlueprint } from '../species/tree';
import type { TreeMaterialState } from '../treeMaterial';

export interface TreeBarkSurfaceConfig {
  /** Bump whenever bark tint, age cues or roughness formulas change. */
  rulesVersion: string;
  quantizationSteps: number;
  toneBands: number;
  roughnessBands: number;
  maximumUniqueTints: number;
  trunkBaseDarkening: number;
  youngBranchLightening: number;
  longitudinalVariation: number;
  radialGrooveStrength: number;
  roughnessMinimum: number;
  roughnessMaximum: number;
}

export interface TreeBarkSurfaceDescriptor {
  id: 'tree:bark:surface-character';
  tintAttributeId: 'tree:bark:vertex-tint';
  roughnessAttributeId: 'tree:bark:roughness-character';
  branchGeometryId: 'tree:bark:branch-sweep';
  staticGeometryId: 'tree:bark:root-collar-sweep';
  materialRole: 'bark';
}

export interface TreeBarkSurfaceDiagnostics {
  branchVertexCount: number;
  staticVertexCount: number;
  staticBarkVertexCount: number;
  preservedTerrainVertexCount: number;
  tintedBranchVertexCount: number;
  tintedStaticBarkVertexCount: number;
  branchRangeCount: number;
  trunkVertexCount: number;
  generatedBranchVertexCount: number;
  maximumGeneration: number;
  uniqueTintCount: number;
  tintBudget: number;
  tintBudgetExceeded: false;
  quantizationSteps: number;
  toneBands: number;
  roughnessBands: number;
  minimumRoughnessCharacter: number;
  maximumRoughnessCharacter: number;
  geometryPreserved: true;
  branchRangesPreserved: true;
  soilTerrainTintPreserved: true;
  materialCount: 2;
  estimatedAdditionalDrawCalls: 0;
  estimatedAdditionalMaterials: 0;
}

export interface TreeBarkSurfaceState {
  treeBarkSurfaceVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceFrameVersion: OrganicCurveFrameState['organicCurveFrameVersion'];
  sourceFrameRulesVersion: string;
  sourceSweepMeshVersion: OrganicSweepMesh['organicSweepMeshVersion'];
  sourceSweepRulesVersion: string;
  sourceRootGeometryVersion: TreeRootGeometryState['treeRootGeometryVersion'];
  sourceRootGeometryRulesVersion: string;
  sourceSoilSurfaceVersion: TreeSoilSurfaceState['treeSoilSurfaceVersion'];
  sourceSoilRulesVersion: string;
  sourceMaterialStateVersion: TreeMaterialState['treeMaterialStateVersion'];
  sourceMaterialRulesVersion: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  descriptor: TreeBarkSurfaceDescriptor;
  signature: string;
  /** RGB multipliers for every accepted branch/trunk sweep vertex. */
  branchVertexColors: number[];
  /** Quantized 0..1 character values consumed by the bark roughness shader path. */
  branchRoughnessCharacters: number[];
  /** Soil-aware RGB multipliers for roots/collar plus untouched terrain tint. */
  staticVertexColors: number[];
  /** Root/collar roughness characters followed by neutral terrain values. */
  staticRoughnessCharacters: number[];
  diagnostics: TreeBarkSurfaceDiagnostics;
}

export interface BuildTreeBarkSurfaceInput {
  species: TreeSpeciesBlueprint;
  frames: OrganicCurveFrameState;
  mesh: OrganicSweepMesh;
  rootGeometry: TreeRootGeometryState;
  soil: TreeSoilSurfaceState;
  materials: TreeMaterialState;
  config: TreeBarkSurfaceConfig;
}
