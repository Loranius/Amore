import type { TreeGroundContactState } from '../groundContact';
import type {
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from '../labs/organic';
import type { TreeRootArchitectureState } from '../rootArchitecture';
import type { TreeTerrainBindingState } from '../terrainBinding';

export interface TreeRootGeometryConfig {
  /** Bump whenever root meshing, LOD or geometry budgets change. */
  rulesVersion: string;
  surface: OrganicSurfaceConfig;
  maximumVerticesByLod: Readonly<Record<OrganicMeshLod, number>>;
  maximumTrianglesByLod: Readonly<Record<OrganicMeshLod, number>>;
}

export interface TreeRootGeometryDiagnostics {
  sourceRootCount: number;
  renderedRootCount: number;
  vertexCount: number;
  triangleCount: number;
  estimatedDrawCalls: number;
  anchoredToGround: true;
  contactApplied: boolean;
  groundLevelY: number | null;
  visiblePathFraction: number | null;
  /** Радіальні сегменти, задані конфігом для цього LOD. */
  radialSegmentsConfigured: number;
  /**
   * Скільки їх лишилось після підгонки під бюджет.
   *
   * Менше за `radialSegmentsConfigured` означає, що корені довелось
   * спростити, аби сітка влізла в стелю. Публікується, щоб «дерево стало
   * простішим» було ЧИСЛОМ у діагностиці, а не здогадкою з екрана.
   */
  radialSegmentsUsed: number;
  collarVertexCount: number;
  collarTriangleCount: number;
  terrainApplied: boolean;
  terrainVertexCount: number;
  terrainTriangleCount: number;
  terrainMergedIntoStaticMesh: boolean;
  vertexBudget: number;
  triangleBudget: number;
  vertexBudgetExceeded: boolean;
  triangleBudgetExceeded: boolean;
  missingRootMeshIds: string[];
  unexpectedMeshBranchIds: string[];
}

export interface TreeRootGeometryState {
  treeRootGeometryVersion: 1;
  rulesVersion: string;
  sourceRootArchitectureVersion: TreeRootArchitectureState['treeRootArchitectureVersion'];
  sourceRootRulesVersion: string;
  sourceGroundContactVersion: TreeGroundContactState['treeGroundContactVersion'] | null;
  sourceGroundContactRulesVersion: string | null;
  sourceTerrainBindingVersion: TreeTerrainBindingState['treeTerrainBindingVersion'] | null;
  sourceTerrainBindingRulesVersion: string | null;
  artifactSeed: number;
  lod: OrganicMeshLod;
  mesh: OrganicSweepMesh;
  diagnostics: TreeRootGeometryDiagnostics;
}

export interface BuildTreeRootGeometryInput {
  roots: TreeRootArchitectureState;
  contact?: TreeGroundContactState;
  terrain?: TreeTerrainBindingState;
  lod: OrganicMeshLod;
  config: TreeRootGeometryConfig;
}
