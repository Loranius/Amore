import type { TreeGroundContactState } from '../groundContact';
import type {
  OrganicMeshLod,
  OrganicSurfaceConfig,
  OrganicSweepMesh,
} from '../labs/organic';
import type { TreeRootArchitectureState } from '../rootArchitecture';

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
  collarVertexCount: number;
  collarTriangleCount: number;
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
  artifactSeed: number;
  lod: OrganicMeshLod;
  mesh: OrganicSweepMesh;
  diagnostics: TreeRootGeometryDiagnostics;
}

export interface BuildTreeRootGeometryInput {
  roots: TreeRootArchitectureState;
  contact?: TreeGroundContactState;
  lod: OrganicMeshLod;
  config: TreeRootGeometryConfig;
}
