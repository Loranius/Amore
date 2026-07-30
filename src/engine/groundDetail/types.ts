import type { GrowthVec3 } from '../growth';
import type { OrganicMeshLod } from '../labs/organic';
import type { TreeSpeciesBlueprint } from '../species/tree';
import type { TreeSoilSurfaceState } from '../soilSurface';
import type { TreeTerrainBindingState } from '../terrainBinding';
import type { TreeRgb } from '../treeMaterial';

export const TREE_GROUND_DETAIL_KINDS = ['stone', 'fallen-leaf', 'moss'] as const;
export type TreeGroundDetailKind = (typeof TREE_GROUND_DETAIL_KINDS)[number];

export type TreeGroundDetailKindBudget = Readonly<Record<TreeGroundDetailKind, number>>;

export interface TreeGroundDetailConfig {
  /** Bump whenever placement, transforms, palette or budgets change. */
  rulesVersion: string;
  maximumInstancesByKindByLod: Readonly<Record<OrganicMeshLod, TreeGroundDetailKindBudget>>;
  innerRadiusRatio: number;
  outerRadiusRatio: number;
  radialJitterRatio: number;
  maximumTemplateVertices: number;
  maximumTemplateTriangles: number;
  colorQuantizationSteps: number;
}

export interface TreeGroundDetailDescriptor {
  id: 'tree:ground-detail:field';
  templateId: 'tree:ground-detail:shared-chip';
  materialId: 'tree:ground-detail:material';
  terrainSurfaceId: 'tree:terrain:surface';
  soilSurfaceId: 'tree:soil:surface';
}

export interface TreeGroundDetailTemplate {
  id: 'tree:ground-detail:shared-chip';
  positions: number[];
  indices: number[];
  vertexCount: number;
  triangleCount: number;
}

export interface TreeGroundDetailInstance {
  id: string;
  sequence: number;
  kindSequence: number;
  kind: TreeGroundDetailKind;
  position: GrowthVec3;
  normal: GrowthVec3;
  yawRad: number;
  scale: GrowthVec3;
  color: TreeRgb;
  sourceTerrainVertexIndex: number;
}

export interface TreeGroundDetailDiagnostics {
  candidateInstanceCount: number;
  emittedInstanceCount: number;
  stoneCount: number;
  fallenLeafCount: number;
  mossCount: number;
  instanceBudget: number;
  stoneBudget: number;
  fallenLeafBudget: number;
  mossBudget: number;
  instanceBudgetExceeded: false;
  truncatedInstanceIds: string[];
  sharedVertexCount: number;
  sharedTriangleCount: number;
  renderedTriangleCount: number;
  templateVertexBudget: number;
  templateTriangleBudget: number;
  templateBudgetExceeded: false;
  colorQuantizationSteps: number;
  stablePrefixPreserved: true;
  anchoredToTerrain: true;
  estimatedDrawCalls: 1;
  estimatedAdditionalMaterials: 1;
  totalMaterialCount: 3;
}

export interface TreeGroundDetailState {
  treeGroundDetailVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: TreeSpeciesBlueprint['speciesBlueprintVersion'];
  sourceTerrainBindingVersion: TreeTerrainBindingState['treeTerrainBindingVersion'];
  sourceTerrainBindingRulesVersion: string;
  sourceSoilSurfaceVersion: TreeSoilSurfaceState['treeSoilSurfaceVersion'];
  sourceSoilSurfaceRulesVersion: string;
  artifactSeed: number;
  lod: OrganicMeshLod;
  descriptor: TreeGroundDetailDescriptor;
  template: TreeGroundDetailTemplate;
  instances: TreeGroundDetailInstance[];
  signature: string;
  diagnostics: TreeGroundDetailDiagnostics;
}

export interface BuildTreeGroundDetailInput {
  species: TreeSpeciesBlueprint;
  terrain: TreeTerrainBindingState;
  soil: TreeSoilSurfaceState;
  config: TreeGroundDetailConfig;
}
