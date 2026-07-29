import type { TreeFoliageState } from '../foliage';
import type { GrowthVec3 } from '../growth';
import type { OrganicMeshLod } from '../labs/organic';

export type TreeLeafGeometryLod = OrganicMeshLod;

export interface TreeLeafGeometryConfig {
  /** Bump whenever leaf sampling, placement or card topology changes. */
  rulesVersion: string;
  renderFractionByLod: Readonly<Record<TreeLeafGeometryLod, number>>;
  maxInstancesByLod: Readonly<Record<TreeLeafGeometryLod, number>>;
  minimumLength: number;
  maximumLength: number;
  minimumWidthRatio: number;
  maximumWidthRatio: number;
  radialSpread: number;
  axialSpread: number;
}

/** Shared renderer-independent leaf-card template used by every instance. */
export interface TreeLeafCardTemplate {
  lod: TreeLeafGeometryLod;
  positions: number[];
  uvs: number[];
  indices: number[];
  vertexCount: number;
  triangleCount: number;
}

/** Stable transform descriptor for one rendered leaf card. */
export interface TreeLeafInstance {
  id: string;
  clusterId: string;
  branchId: string;
  localIndex: number;
  sequence: number;
  seed: number;
  position: GrowthVec3;
  direction: GrowthVec3;
  normal: GrowthVec3;
  length: number;
  width: number;
  rollRad: number;
}

export interface TreeLeafGeometryDiagnostics {
  sourceClusterCount: number;
  candidateInstanceCount: number;
  renderedInstanceCount: number;
  truncatedInstanceIds: string[];
  clusterIdsWithoutInstances: string[];
  sharedVertexCount: number;
  sharedTriangleCount: number;
  renderedTriangleCount: number;
  estimatedDrawCalls: 1;
  instanceBudgetReached: boolean;
}

export interface TreeLeafGeometryState {
  treeLeafGeometryVersion: 1;
  rulesVersion: string;
  sourceFoliageVersion: TreeFoliageState['treeFoliageVersion'];
  sourceFoliageRulesVersion: string;
  artifactSeed: number;
  lod: TreeLeafGeometryLod;
  template: TreeLeafCardTemplate;
  instances: TreeLeafInstance[];
  diagnostics: TreeLeafGeometryDiagnostics;
}

export interface BuildTreeLeafGeometryInput {
  foliage: TreeFoliageState;
  lod: TreeLeafGeometryLod;
  config: TreeLeafGeometryConfig;
}
