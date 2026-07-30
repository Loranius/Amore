import type { CrystalCompositionState } from '../composition/types';
import type { GrowthBody, GrowthState, GrowthVec3 } from '../growth';
import type { CrystalGeologyState } from '../species/crystal/geology';

export type CrystalLodLevel = 'high' | 'medium' | 'low';

export interface CrystalGeometryConfig {
  /** Bump whenever profile, topology, trim or budget rules change. */
  rulesVersion: string;
  maxVertices: number;
  maxTriangles: number;
  hiddenFaceEpsilon: number;
}

export interface CrystalProfileRow {
  y: number;
  radius: number;
}

export interface CrystalBodyProfile {
  profileVersion: 1;
  bodyId: string;
  archetype: string;
  lod: CrystalLodLevel;
  segments: number;
  extraSink: number;
  geometryLength: number;
  geometryAnchor: GrowthVec3;
  scaleX: number;
  scaleZ: number;
  rows: CrystalProfileRow[];
  signature: string;
}

export interface CrystalMeshBounds {
  min: GrowthVec3;
  max: GrowthVec3;
  center: GrowthVec3;
  radius: number;
}

export interface CrystalMeshData {
  meshVersion: 1;
  bodyId: string;
  hostBodyId: string | null;
  lod: CrystalLodLevel;
  profile: CrystalBodyProfile;
  positions: number[];
  normals: number[];
  indices: number[];
  sourceTriangleCount: number;
  visibleTriangleCount: number;
  removedTriangleCount: number;
  baseCapTriangleCount: number;
  baseCapRemoved: boolean;
  occluderBodyIds: string[];
  bounds: CrystalMeshBounds;
}

export interface CrystalAttachmentJunction {
  junctionVersion: 1;
  id: string;
  hostBodyId: string;
  childBodyId: string;
  origin: GrowthVec3;
  normal: GrowthVec3;
  tangent: GrowthVec3;
  bitangent: GrowthVec3;
  contactRadius: number;
  penetrationDepth: number;
  clearanceRadius: number;
  trimPolicy: 'hidden-face-removal';
  seamPolicy: 'sealed-overlap';
  materialBlendWidth: number;
  sealed: boolean;
}

export interface CrystalGeometryBudget {
  maxVertices: number;
  maxTriangles: number;
  usedVertices: number;
  usedTriangles: number;
  highLodBodyCount: number;
  mediumLodBodyCount: number;
  lowLodBodyCount: number;
  budgetExceeded: boolean;
}

export interface CrystalGeometryDiagnostics {
  missingHostBodyIds: string[];
  unsealedJunctionIds: string[];
  meshesWithoutVisibleTriangles: string[];
  nonFiniteBodyIds: string[];
  downgradedBodyIds: string[];
  budgetOmittedBodyIds: string[];
}

export interface CrystalGeometryState {
  geometryStateVersion: 1;
  rulesVersion: string;
  sourceGrowthStateVersion: GrowthState['growthStateVersion'];
  sourceCompositionStateVersion: CrystalCompositionState['compositionStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  /** New builds include this; optional keeps persisted Geometry State v1 snapshots readable. */
  geology?: CrystalGeologyState;
  meshes: CrystalMeshData[];
  junctions: CrystalAttachmentJunction[];
  budget: CrystalGeometryBudget;
  diagnostics: CrystalGeometryDiagnostics;
}

export interface BuildCrystalGeometryInput {
  growth: GrowthState;
  composition: CrystalCompositionState;
  config: CrystalGeometryConfig;
}

export interface CrystalSolid {
  body: GrowthBody;
  profile: CrystalBodyProfile;
  bounds: CrystalMeshBounds;
}
