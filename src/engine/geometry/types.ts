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
  /** Conservative radius retained for trim/solid compatibility. */
  radius: number;
  radiusX: number;
  radiusZ: number;
  centerOffsetX: number;
  centerOffsetZ: number;
  rotation: number;
  facetPhase: number;
}

/**
 * One vertical facet of a crystal, as an angle around the axis and a radius
 * multiplier at that angle.
 *
 * The ring is defined **once per body** and every slice reuses it. That is what
 * makes a side face flat: with a shared ring, each row can only scale the radius
 * and translate the centre, and both of those keep the quad between two rows a
 * trapezoid — its bottom and top edges stay parallel, so the four corners are
 * coplanar and both triangles get the same normal.
 *
 * Turning, drifting or re-jittering a ring per row breaks that parallelism. The
 * quad stops being planar, its two triangles get different normals, and the
 * crystal renders as a mosaic of small triangles instead of a few large faces —
 * which is exactly what visual review rejected (2026-08-03).
 */
export interface CrystalRingFacet {
  angle: number;
  radiusScale: number;
  /** True for the narrow chamfers earned from photos, false for the main faces. */
  chamfer: boolean;
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
  twistTotal: number;
  axisLeanX: number;
  axisLeanZ: number;
  burialStartY: number;
  burialCompression: number;
  rows: CrystalProfileRow[];
  /** Shared cross-section. Optional so older persisted profiles stay readable. */
  ring?: CrystalRingFacet[];
  /**
   * Bearings, in radians, along which the quartz vein runs out from its node.
   *
   * Published because the vein does not stop at the artifact: the portal's
   * stone platform bows where the seam runs under it, and a platform bowing in
   * its own directions would read as a second, unrelated fracture system rather
   * than as the same stone giving way. Only the substrate carries it, and only
   * new builds — optional keeps persisted Geometry State v1 profiles readable.
   */
  veinBearings?: number[];
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
