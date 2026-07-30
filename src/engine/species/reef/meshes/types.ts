import type {
  ReefColonyMorphotype,
  ReefSpeciesBlueprint,
} from '../types';
import type { ReefColonyLayoutState, ReefLayoutVec3 } from '../layout';
import type { ReefFoundationMeshState } from '../foundation';
import type { ReefColonySkeletonState } from '../skeletons';

export interface ReefColonyMeshConfig {
  /** Bump whenever meshing, topology or geometry budgets change. */
  rulesVersion: string;
  tubeRadialSegments: number;
  minimumSegmentLength: number;
  maximumVertices: number;
  maximumTriangles: number;
}

export interface ReefMeshVec2 {
  u: number;
  v: number;
}

export interface ReefColonyMeshVertex {
  id: string;
  sequence: number;
  colonyId: string;
  morphotype: ReefColonyMorphotype;
  position: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  uv: ReefMeshVec2;
}

export interface ReefColonyMeshTriangle {
  id: string;
  sequence: number;
  colonyId: string;
  morphotype: ReefColonyMorphotype;
  a: number;
  b: number;
  c: number;
}

export interface ReefColonyMeshBounds {
  minimum: ReefLayoutVec3;
  maximum: ReefLayoutVec3;
  center: ReefLayoutVec3;
  radius: number;
}

/** Stable slice of a morphotype batch owned by exactly one colony. */
export interface ReefColonyMeshRange {
  id: string;
  colonyId: string;
  skeletonId: string;
  morphotype: ReefColonyMorphotype;
  sequence: number;
  vertexStart: number;
  vertexCount: number;
  triangleStart: number;
  triangleCount: number;
  indexStart: number;
  indexCount: number;
  bounds: ReefColonyMeshBounds;
}

/** Renderer-independent merged geometry for one morphotype. */
export interface ReefColonyMeshBatch {
  id: string;
  morphotype: ReefColonyMorphotype;
  vertices: ReefColonyMeshVertex[];
  triangles: ReefColonyMeshTriangle[];
  /** Renderer-ready flat index buffer matching `triangles`. */
  index: number[];
  ranges: ReefColonyMeshRange[];
}

export interface ReefColonyMeshDiagnostics {
  sourceSkeletonCount: number;
  meshedColonyCount: number;
  batchCount: number;
  vertexCount: number;
  triangleCount: number;
  indexCount: number;
  morphotypeVertexCounts: Record<ReefColonyMorphotype, number>;
  morphotypeTriangleCounts: Record<ReefColonyMorphotype, number>;
  colonyIdsWithoutSkeleton: string[];
  skeletonIdsWithoutColony: string[];
  colonyIdsWithoutMesh: string[];
  invalidTriangleIds: string[];
  degenerateTriangleIds: string[];
  nonFiniteVertexIds: string[];
  nonUnitNormalVertexIds: string[];
  maximumVertices: number;
  maximumTriangles: number;
  geometryBudgetExceeded: boolean;
  estimatedDrawCalls: number;
  materialSlots: number;
  perFrameUpdates: 0;
}

export interface ReefColonyMeshState {
  reefColonyMeshVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:colony-meshes';
    batchId: 'reef:colony-mesh-batch';
    rangeId: 'reef:colony-mesh-range';
    vertexId: 'reef:colony-mesh-vertex';
    triangleId: 'reef:colony-mesh-triangle';
  };
  sourceSpeciesBlueprintVersion: ReefSpeciesBlueprint['speciesBlueprintVersion'];
  sourceSpeciesRulesVersion: string;
  sourceColonyLayoutVersion: ReefColonyLayoutState['reefColonyLayoutVersion'];
  sourceColonyLayoutRulesVersion: string;
  sourceFoundationMeshVersion: ReefFoundationMeshState['reefFoundationMeshVersion'];
  sourceFoundationRulesVersion: string;
  sourceColonySkeletonVersion: ReefColonySkeletonState['reefColonySkeletonVersion'];
  sourceColonySkeletonRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  batches: ReefColonyMeshBatch[];
  diagnostics: ReefColonyMeshDiagnostics;
}

export interface BuildReefColonyMeshesInput {
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  foundation: ReefFoundationMeshState;
  skeletons: ReefColonySkeletonState;
  config?: ReefColonyMeshConfig;
}
