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

/**
 * One cut. The solid is every point with `normal · p <= offset`, in the body's
 * own frame: origin at `geometryAnchor`, +Y along the body's direction.
 *
 * `kind` is not decoration — the mesh publishes its base cap from the `base`
 * plane and nothing else, and trimming relies on that.
 */
export interface CrystalFacePlane {
  normal: GrowthVec3;
  offset: number;
  kind: 'base' | 'prism' | 'bevel' | 'crown' | 'safety';
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
   * The half-spaces the body is cut from, in its own frame.
   *
   * Since ADR-0006 this — not `rows` — is what the crystal actually *is*. A
   * lathe could only ever produce faces that were equal by construction, and
   * any attempt to vary them bent the quad between two slices out of plane.
   * Here every face is a plane, so the set can be as unequal as a real crystal
   * without a single face losing its flatness.
   *
   * `rows` is still published beside it as a conservative envelope, because
   * readers that only need "how wide is this body at that height" should not
   * have to solve a linear system — and because persisted Geometry State v1
   * snapshots have no planes. Optional for exactly that reason.
   */
  planes?: CrystalFacePlane[];
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
  /**
   * Per-face planar texture coordinates, in engine units.
   *
   * The crystal has no unwrap and cannot have one: it is a polytope whose faces
   * are a different shape on every couple, so there is no atlas that would fit
   * and no seam layout that would survive the next seed. Each face is planar
   * though, so projecting it onto its own plane is exact — no stretch, no
   * distortion, and the only seams are the facet edges, which are hard edges
   * already.
   *
   * Left in engine units rather than normalised to 0..1 deliberately. Normalising
   * per face would give a small crystal the same number of texture cells as the
   * monarch, so the grain would shrink with the body instead of staying the
   * grain of one mineral. Density is the material's decision, applied as a
   * multiplier; this only says which way the face lies.
   *
   * Optional so persisted Geometry State v1 meshes stay readable.
   */
  uvs?: number[];
  /**
   * Which face each triangle belongs to — one entry per triangle, in index
   * order.
   *
   * Published because the face is no longer inferable from the triangle's
   * position. Under the lathe every face was exactly two triangles laid out in
   * ring order, so `floor(triangle / 2) % ringLength` named it; readers relied
   * on that, and since ADR-0006 it has been wrong. A polytope face is fanned
   * into as many triangles as it has corners minus two — a different count on
   * every face — and slivers are dropped, so no arithmetic on the triangle
   * index recovers the face.
   *
   * That silently broke per-face tone (`facets.ts`): tints scattered across
   * triangles instead of landing per plane, so neighbouring facets averaged to
   * within a few percent of each other and the crystal read as a smooth shape.
   * The identifiers are opaque and dense from zero; only equality is meaningful.
   *
   * Optional so persisted Geometry State v1 meshes stay readable.
   */
  faceIds?: number[];
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
