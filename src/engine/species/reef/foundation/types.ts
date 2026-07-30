import type { ReefSpeciesBlueprint } from '../types';
import type {
  ReefColonyLayoutState,
  ReefLayoutVec3,
} from '../layout';

export type ReefFoundationSurface = 'top' | 'side' | 'bottom';

export interface ReefFoundationMeshConfig {
  /** Bump whenever topology, sampling or shell rules change. */
  rulesVersion: string;
  /** Depth of the closed outer skirt relative to substrate radius. */
  skirtDepthRatio: number;
  maximumVertices: number;
  maximumTriangles: number;
}

export interface ReefFoundationVertex {
  id: string;
  sequence: number;
  surface: ReefFoundationSurface;
  ringIndex: number | null;
  azimuthSectorIndex: number | null;
  position: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  uv: { u: number; v: number };
}

export interface ReefFoundationTriangle {
  id: string;
  sequence: number;
  surface: ReefFoundationSurface;
  patchId: string;
  a: number;
  b: number;
  c: number;
}

export interface ReefFoundationPatch {
  id: string;
  surface: ReefFoundationSurface;
  substrateCellId: string | null;
  radialBand: number | null;
  azimuthSectorIndex: number;
  triangleIds: string[];
}

/** Stable attachment consumed by later colony-geometry phases. */
export interface ReefFoundationAttachment {
  id: string;
  colonyId: string;
  substrateCellId: string;
  patchId: string;
  position: ReefLayoutVec3;
  normal: ReefLayoutVec3;
  facingRad: number;
  footprintRadius: number;
  targetHeight: number;
}

export interface ReefFoundationMeshDiagnostics {
  radialBandCount: number;
  azimuthSectorCount: number;
  vertexCount: number;
  triangleCount: number;
  topTriangleCount: number;
  sideTriangleCount: number;
  bottomTriangleCount: number;
  cellPatchCount: number;
  attachmentCount: number;
  cellIdsWithoutPatch: string[];
  colonyIdsWithoutAttachment: string[];
  degenerateTriangleIds: string[];
  boundaryEdgeCount: number;
  nonManifoldEdgeCount: number;
  closedShell: boolean;
  maximumVertices: number;
  maximumTriangles: number;
  geometryBudgetExceeded: boolean;
  estimatedDrawCalls: 1;
  materialSlots: 1;
  perFrameUpdates: 0;
}

export interface ReefFoundationMeshState {
  reefFoundationMeshVersion: 1;
  rulesVersion: string;
  descriptor: {
    id: 'reef:foundation-mesh';
    vertexId: 'reef:foundation-vertex';
    triangleId: 'reef:foundation-triangle';
    patchId: 'reef:foundation-patch';
    attachmentId: 'reef:foundation-attachment';
  };
  sourceSpeciesBlueprintVersion: ReefSpeciesBlueprint['speciesBlueprintVersion'];
  sourceSpeciesRulesVersion: string;
  sourceColonyLayoutVersion: ReefColonyLayoutState['reefColonyLayoutVersion'];
  sourceColonyLayoutRulesVersion: string;
  artifactSeed: number;
  asOf: string;
  vertices: ReefFoundationVertex[];
  triangles: ReefFoundationTriangle[];
  /** Renderer-ready flat index buffer matching `triangles`. */
  index: number[];
  patches: ReefFoundationPatch[];
  attachments: ReefFoundationAttachment[];
  diagnostics: ReefFoundationMeshDiagnostics;
}

export interface BuildReefFoundationMeshInput {
  species: ReefSpeciesBlueprint;
  layout: ReefColonyLayoutState;
  config?: ReefFoundationMeshConfig;
}
