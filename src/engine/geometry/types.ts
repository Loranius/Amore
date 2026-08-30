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
  kind: 'base' | 'prism' | 'bevel' | 'shoulder' | 'crown' | 'safety';
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
   * Радіус, на якому тіло РЕАЛЬНО різалось, у власних одиницях.
   *
   * З'явився разом із габітусами. Доти він завжди дорівнював
   * `body.renderedRadius`, тож `mesh.ts` спокійно брав допуск від тіла, а
   * `profile.ts` — від тієї самої величини. Обхват габітусу (`girth`)
   * цю рівність розірвав: тупа форма ріжеться на 1.22 радіуса, голка на
   * 0.64, і допуск злиття кутів `polytopeTolerance` розійшовся б між
   * профілем і сіткою на ті самі відсотки.
   *
   * Чим це погано, сказано в самому `polytopeTolerance`: «оболонка,
   * зміряна на одному допуску й намальована на іншому, перестає
   * містити тіло». Тобто це не педантизм — це та сама вада, від якої
   * той допуск і звели в одне місце.
   *
   * Необов'язковий, щоб збережені знімки Geometry State v1 лишались
   * читабельними; читач без нього падає назад на радіус тіла — рівно
   * те, що там і було записано.
   */
  cutRadius?: number;
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
  /**
   * How many of the substrate's leading triangles belong to the seam itself,
   * before the rubble heaped on it.
   *
   * The seam and the boulders are one mesh — same stone, same material, one
   * draw call — but they answer to different rules. The seam is the thing wide
   * and deep enough that no crystal's base cap is ever exposed from below
   * (ADR-0003), and it is checked against that; the boulders sit on top of it
   * and are meant to stand proud of its lip, which would read as a violation to
   * anything measuring the seam's own height. Published so the two can be told
   * apart without guessing from geometry.
   *
   * Triangles, not vertices: the mesh is split before it is drawn and the split
   * gives every triangle its own copies, so vertex indices do not survive it.
   * Triangle order does, one for one, and the seam is emitted first.
   *
   * Substrate meshes only, and only new ones.
   */
  seamTriangleCount?: number;
  /**
   * Висота губи шва — тієї, що тримається біля кристалів.
   *
   * Публікується, бо інакше її доводиться вгадувати, і три тести вгадали
   * неправильно: вони брали НАЙВИЩУ точку шва й називали її губою. Це
   * було правдою рівно доти, доки в жеоди не з'явилась стінка по
   * периметру — відтоді найвища точка шва це стінка, а губа лишилась
   * там само.
   *
   * Та сама причина, з якої поруч стоїть `seamTriangleCount`: коли на
   * шов поклали брили, «найвища точка меша» перестала означати «шов», і
   * геометрія почала публікувати межу явно замість того, щоб читач її
   * виводив.
   *
   * Підкладка, і лише нова.
   */
  seamRimHeight?: number;
  /** Наскільки стінка жеоди підіймається над губою в найвищій точці. */
  geodeWallHeight?: number;
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
  /**
   * Which of a triangle's three edges are edges of the facet itself — one
   * bitmask per triangle, bit `k` set when the edge opposite corner `k` is a
   * real border rather than an internal cut of the fan.
   *
   * Published so the renderer can light the facet edges without an unwrap.
   * Studying three stylized gem assets the owner supplied (2026-08-03) showed
   * the same technique in all of them, in every channel at once: albedo,
   * roughness and emissive each treat a facet's rim differently from its
   * interior, and the handpainted pack goes furthest — `KHR_materials_unlit`,
   * no lighting model at all, the entire crystal painted into base colour. The
   * facet edge is *drawn*, not lit.
   *
   * That matters here because measurement said lighting was never going to do
   * it: with the key light switched off entirely the monarch's facets moved by
   * about 3%. A crystal reads as a crystal because its planes are outlined, and
   * an outline that survives the lighting has to come from the surface itself.
   *
   * A fan is what makes this need publishing. Every triangle of a face shares
   * the face's plane, but only some of its edges are the polygon's — the rest
   * are cuts through the middle of a flat face, and lighting those would draw a
   * spider's web across every facet. Only the pass that builds the fan knows
   * which is which.
   *
   * Optional: persisted Geometry State v1 meshes have none, and the lathe does
   * not publish them either — its quads are cut across a face for a different
   * reason, and it survives only for profiles that carry no planes.
   */
  borderEdges?: number[];
  /**
   * Where each vertex sits along the body's own axis — 0 at its foot, 1 at its
   * tip, one entry per vertex.
   *
   * Published because the renderer cannot work it out. Bodies are batched by
   * material signature, so one material draws several crystals of different
   * heights at once; a uniform would give them all the monarch's scale, and
   * object-space Y would need each body's own extent, which is exactly the
   * thing a shared material does not have. A per-vertex fraction is the only
   * form that survives batching.
   *
   * What it is for: every stylized reference crystal carries a colour that
   * changes from foot to tip — one hue where it left the rock, another at the
   * point. That is a real habit (a phantom, or a change in what the fluid
   * carried while the crystal grew) and it is most of what makes a reference
   * gem look grown rather than moulded.
   *
   * Measured along the axis rather than in world height so a crystal leaning at
   * forty-five degrees still reads foot-to-tip along itself, not bottom-to-top
   * of the screen.
   *
   * Optional so persisted Geometry State v1 meshes stay readable.
   */
  axialT?: number[];
  /**
   * Normalised body coordinates, three per vertex: x and z in -1..1 across the
   * body's widest slice, y in 0..1 from root to tip.
   *
   * The frame the inner flow is described in. It is a shape *inside* the
   * crystal, so it has to live in the crystal's own space — in world space a
   * leaning child would carry a spiral leaning the other way, and a tall body
   * and a short one would carry different-sized ones.
   */
  bodyCoord?: number[];
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
