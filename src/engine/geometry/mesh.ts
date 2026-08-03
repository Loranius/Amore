import {
  add,
  cross,
  length,
  normalize,
  orthonormalBasis,
  round6,
  scale,
  subtract,
} from '../growth/math';
import type { GrowthBody, GrowthVec3 } from '../growth';
import { buildCrystalProfile } from './profile';
import { intersectHalfSpaces, polytopeTolerance } from './polytope';
import type {
  CrystalLodLevel,
  CrystalMeshBounds,
  CrystalMeshData,
  CrystalProfileRow,
} from './types';

function vertexAt(positions: readonly number[], index: number): GrowthVec3 {
  return {
    x: positions[index * 3] ?? 0,
    y: positions[index * 3 + 1] ?? 0,
    z: positions[index * 3 + 2] ?? 0,
  };
}

function pushVertex(positions: number[], point: GrowthVec3): number {
  const index = positions.length / 3;
  positions.push(round6(point.x), round6(point.y), round6(point.z));
  return index;
}

function computeNormals(positions: readonly number[], indices: readonly number[]): number[] {
  const normals = Array.from({ length: positions.length }, () => 0);
  for (let offset = 0; offset < indices.length; offset += 3) {
    const ia = indices[offset] ?? 0;
    const ib = indices[offset + 1] ?? 0;
    const ic = indices[offset + 2] ?? 0;
    const a = vertexAt(positions, ia);
    const b = vertexAt(positions, ib);
    const c = vertexAt(positions, ic);
    const face = cross(subtract(b, a), subtract(c, a));
    for (const index of [ia, ib, ic]) {
      normals[index * 3] = (normals[index * 3] ?? 0) + face.x;
      normals[index * 3 + 1] = (normals[index * 3 + 1] ?? 0) + face.y;
      normals[index * 3 + 2] = (normals[index * 3 + 2] ?? 0) + face.z;
    }
  }
  for (let index = 0; index < normals.length / 3; index += 1) {
    const normal = normalize({
      x: normals[index * 3] ?? 0,
      y: normals[index * 3 + 1] ?? 0,
      z: normals[index * 3 + 2] ?? 0,
    });
    normals[index * 3] = round6(normal.x);
    normals[index * 3 + 1] = round6(normal.y);
    normals[index * 3 + 2] = round6(normal.z);
  }
  return normals;
}

function computeBounds(positions: readonly number[]): CrystalMeshBounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < positions.length; offset += 3) {
    const x = positions[offset] ?? 0;
    const y = positions[offset + 1] ?? 0;
    const z = positions[offset + 2] ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }
  const min = { x: minX, y: minY, z: minZ };
  const max = { x: maxX, y: maxY, z: maxZ };
  const center = {
    x: (minX + maxX) * 0.5,
    y: (minY + maxY) * 0.5,
    z: (minZ + maxZ) * 0.5,
  };
  let radius = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    radius = Math.max(radius, length(subtract({
      x: positions[offset] ?? 0,
      y: positions[offset + 1] ?? 0,
      z: positions[offset + 2] ?? 0,
    }, center)));
  }
  return {
    min: { x: round6(min.x), y: round6(min.y), z: round6(min.z) },
    max: { x: round6(max.x), y: round6(max.y), z: round6(max.z) },
    center: { x: round6(center.x), y: round6(center.y), z: round6(center.z) },
    radius: round6(radius),
  };
}

function rowCenter(
  anchor: GrowthVec3,
  direction: GrowthVec3,
  tangent: GrowthVec3,
  bitangent: GrowthVec3,
  row: CrystalProfileRow,
): GrowthVec3 {
  return add(
    add(
      add(anchor, scale(direction, row.y)),
      scale(tangent, row.centerOffsetX),
    ),
    scale(bitangent, row.centerOffsetZ),
  );
}

export /** cos(38°): past this a vertex normal is averaging across an edge, not a curve. */
const SMOOTH_CREASE_COSINE = 0.788;

/** Reference directions for the per-face texture basis; the second covers poles. */
const UP: GrowthVec3 = { x: 0, y: 1, z: 0 };
const SIDE: GrowthVec3 = { x: 1, y: 0, z: 0 };

export function rebuildCrystalMeshNormals(mesh: CrystalMeshData): CrystalMeshData {
  return { ...mesh, normals: computeNormals(mesh.positions, mesh.indices) };
}

/**
 * Splits a shell so every triangle owns its three vertices and carries its own
 * face normal.
 *
 * `flatShading: true` on the Three material produced the same picture, and that
 * was the problem: the *published* geometry still described a smooth surface,
 * so what the couple's crystal looked like depended on a renderer flag rather
 * than on the artifact. Anything else consuming the state — a second renderer,
 * a snapshot, an export — would have got the smooth version.
 *
 * Costs roughly three times the vertices. The whole druse is around 1,500
 * before the split against a budget of 18,000, so this buys correctness at a
 * price the budget does not notice.
 *
 * Run after trimming, not before: trimming drops triangles from the index list,
 * and splitting first would leave the removed triangles' vertices stranded in
 * the buffer, inflating the reported vertex count with geometry nothing draws.
 */
export function splitCrystalMeshFaces(
  mesh: CrystalMeshData,
  options: { smooth?: boolean } = {},
): CrystalMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const sources = [
      mesh.indices[offset] ?? 0,
      mesh.indices[offset + 1] ?? 0,
      mesh.indices[offset + 2] ?? 0,
    ] as const;
    const corners = [
      vertexAt(mesh.positions, sources[0]),
      vertexAt(mesh.positions, sources[1]),
      vertexAt(mesh.positions, sources[2]),
    ] as const;
    const face = normalize(cross(
      subtract(corners[1], corners[0]),
      subtract(corners[2], corners[0]),
    ));
    // Texture coordinates, projected onto the triangle's own plane.
    //
    // This is the only unwrap a crystal can have. It has no atlas and cannot
    // get one — the faces are a different shape on every couple — but every
    // face is planar, so its own plane is an exact parameterisation of it: no
    // stretch anywhere, and the only seams fall on facet edges, which are hard
    // edges already and hide them.
    //
    // The basis is derived from the face normal alone, so the two triangles of
    // one face agree and the texture crosses between them without a break.
    const reference = Math.abs(face.y) < 0.9 ? UP : SIDE;
    const uAxis = normalize(cross(reference, face));
    const vAxis = normalize(cross(face, uAxis));

    for (let slot = 0; slot < 3; slot += 1) {
      const corner = corners[slot]!;
      uvs.push(
        round6(corner.x * uAxis.x + corner.y * uAxis.y + corner.z * uAxis.z),
        round6(corner.x * vAxis.x + corner.y * vAxis.y + corner.z * vAxis.z),
      );
      indices.push(pushVertex(positions, corners[slot]!));
      // Faceted by default: a crystal's side is a flat plane and every triangle
      // on it must say so. `smooth` carries the mesh's own averaged normals
      // through the split instead — for a surface that is genuinely curved, a
      // per-triangle normal is not detail but banding, because the two
      // triangles of a curved quad are never coplanar. The split still happens,
      // so per-face vertex colour keeps working either way.
      // A crease angle, not a flat "smooth everything". The plate's collar is
      // gently curved and must not band; the wall of a crack is a near-vertical
      // step and must stay sharp. Averaging across both gave soft wedges
      // instead of cracks. Where the averaged normal has swung more than the
      // threshold away from the face it belongs to, the face wins.
      const averaged = vertexAt(mesh.normals, sources[slot]!);
      const alignment = averaged.x * face.x + averaged.y * face.y + averaged.z * face.z;
      const normal = options.smooth && alignment > SMOOTH_CREASE_COSINE ? averaged : face;
      normals.push(round6(normal.x), round6(normal.y), round6(normal.z));
    }
  }

  // `faceIds` rides through untouched: this rebuilds every triangle in place,
  // one for one and in the same order, so the face a triangle belonged to
  // before the split is the face it belongs to after it.
  return {
    ...mesh,
    positions,
    normals,
    uvs,
    indices,
    // Bounds are unchanged in principle — the same points, listed more times —
    // but recomputing keeps the published state self-consistent rather than
    // asking a reader to trust that.
    bounds: computeBounds(positions),
  };
}

/**
 * Pure indexed mesh builder; no THREE, canvas, renderer or material imports.
 *
 * Since ADR-0006 a crystal is the intersection of its published half-spaces, so
 * this walks the polytope's faces rather than a stack of rings. Each face is
 * fanned from its own first vertex — every triangle of a face therefore lies in
 * that face's plane, which is the property the whole faceting rests on: the
 * faces may be as unequal as a real crystal's without a single one of them
 * bending. The base plane's face is emitted first, because `trimCrystalMesh`
 * identifies the base cap by triangle index.
 */
export function buildCrystalMesh(body: GrowthBody, lod: CrystalLodLevel): CrystalMeshData {
  const profile = buildCrystalProfile(body, lod);
  const planes = profile.planes;
  if (planes === undefined || planes.length === 0) {
    return buildLatheCrystalMesh(body, lod, profile);
  }

  const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius));
  if (polytope === null) {
    throw new Error(`Crystal Geometry could not mesh a solid for "${body.id}".`);
  }

  // `orthonormalBasis` gives a frame with `tangent × bitangent = direction`, so
  // taking the body's axis as the *middle* coordinate — which is what the plane
  // set is written in — makes (tangent, direction, bitangent) left-handed. The
  // negated bitangent puts the handedness back, and without it every face winds
  // inward: back-face culling then draws the inside of the crystal.
  const { tangent, bitangent } = orthonormalBasis(body.direction);
  const toWorld = (local: GrowthVec3): GrowthVec3 => add(
    add(
      add(profile.geometryAnchor, scale(tangent, local.x)),
      scale(body.direction, local.y),
    ),
    scale(bitangent, -local.z),
  );

  const positions: number[] = [];
  const indices: number[] = [];
  for (const vertex of polytope.vertices) pushVertex(positions, toWorld(vertex));

  // Base first. Ordering faces by kind rather than by plane index would be the
  // same thing today — the base is plane zero — but the mesh must not depend on
  // the generator's ordering to keep a published invariant true.
  const ordered = [...polytope.faces].sort((left, right) => {
    const rank = (face: typeof left): number => (planes[face.planeIndex]!.kind === 'base' ? 0 : 1);
    return rank(left) - rank(right) || left.planeIndex - right.planeIndex;
  });

  // A sliver — three corners of a face that are very nearly collinear — covers
  // no pixels, but its normal is whatever the rounding of its corners happened
  // to leave, and every downstream pass takes normals from triangle geometry.
  // One sliver is therefore one facet lit wrongly, so they are dropped rather
  // than shaded. Scaled to the body: an absolute threshold would delete real
  // faces on a year crystal and keep slivers on the monarch.
  const sliverArea = Math.max(1e-12, body.renderedRadius * body.renderedRadius * 1e-5);
  const area = (ia: number, ib: number, ic: number): number => {
    const a = vertexAt(positions, ia);
    const b = vertexAt(positions, ib);
    const c = vertexAt(positions, ic);
    return length(cross(subtract(b, a), subtract(c, a))) * 0.5;
  };

  let baseCapTriangleCount = 0;
  // One identifier per emitted triangle, counted over the faces that actually
  // emitted something. Using the plane index instead would leave gaps wherever
  // a face collapsed to slivers, and readers treat these as dense.
  const faceIds: number[] = [];
  // Which edges of each triangle are edges of the facet. A fan cuts a polygon
  // into triangles from one corner, so two of every triangle's edges are
  // usually interior to a flat face — lighting those would draw a web across
  // the facet instead of outlining it.
  const borderEdges: number[] = [];
  let faceId = 0;
  for (const face of ordered) {
    const loop = face.loop;
    const isBase = planes[face.planeIndex]!.kind === 'base';
    const last = loop.length - 1;
    let emitted = 0;
    for (let corner = 1; corner + 1 < loop.length; corner += 1) {
      const ia = loop[0]!;
      const ib = loop[corner]!;
      const ic = loop[corner + 1]!;
      if (area(ia, ib, ic) < sliverArea) continue;
      indices.push(ia, ib, ic);
      faceIds.push(faceId);
      // Bit k marks the edge opposite corner k. Opposite the fan's apex lies
      // (ib, ic), which walks the polygon's rim and is therefore always real;
      // the other two run back to the apex and are real only at the two ends of
      // the fan, where they coincide with the polygon's first and last edges.
      borderEdges.push(
        1
        | (corner + 1 === last ? 2 : 0)
        | (corner === 1 ? 4 : 0),
      );
      emitted += 1;
      if (isBase) baseCapTriangleCount += 1;
    }
    if (emitted > 0) faceId += 1;
  }

  const sourceTriangleCount = indices.length / 3;
  return {
    meshVersion: 1,
    bodyId: body.id,
    hostBodyId: body.hostBodyId,
    lod,
    profile,
    positions,
    normals: computeNormals(positions, indices),
    faceIds,
    borderEdges,
    indices,
    sourceTriangleCount,
    visibleTriangleCount: sourceTriangleCount,
    removedTriangleCount: 0,
    baseCapTriangleCount,
    baseCapRemoved: false,
    occluderBodyIds: [],
    bounds: computeBounds(positions),
  };
}

/**
 * The lathe that came before ADR-0006.
 *
 * Kept for profiles that carry no planes — persisted Geometry State v1
 * snapshots, and any species that still describes itself as rings. It is not a
 * fallback for a crystal: a crystal whose planes failed to close throws rather
 * than quietly rendering as a different shape.
 */
function buildLatheCrystalMesh(
  body: GrowthBody,
  lod: CrystalLodLevel,
  built?: ReturnType<typeof buildCrystalProfile>,
): CrystalMeshData {
  const profile = built ?? buildCrystalProfile(body, lod);
  const { tangent, bitangent } = orthonormalBasis(body.direction);
  const positions: number[] = [];
  const indices: number[] = [];
  const ring = profile.ring ?? Array.from({ length: profile.segments }, (_, index) => ({
    angle: (index / profile.segments) * Math.PI * 2,
    radiusScale: 1,
    chamfer: false,
  }));
  const segments = ring.length;

  for (let rowIndex = 0; rowIndex < profile.rows.length; rowIndex += 1) {
    const row = profile.rows[rowIndex]!;
    const center = rowCenter(
      profile.geometryAnchor,
      body.direction,
      tangent,
      bitangent,
      row,
    );
    // One ring for the whole body. Every slice reuses the same angles and the
    // same per-facet radius multipliers, so the only thing that changes between
    // two slices is an overall scale and a translation — and both keep the quad
    // between them a trapezoid, which is what makes a side face flat.
    //
    // The jitter that used to live here was indexed by row as well as by facet,
    // so the ring was subtly different at every height. That is what turned each
    // side into a strip of non-planar quads and produced the triangle mosaic.
    for (const facet of ring) {
      const angle = facet.angle + row.rotation + row.facetPhase;
      const radial = add(
        scale(tangent, Math.cos(angle) * row.radiusX * facet.radiusScale),
        scale(bitangent, Math.sin(angle) * row.radiusZ * facet.radiusScale),
      );
      pushVertex(positions, add(center, radial));
    }
  }

  const firstRow = profile.rows[0]!;
  const baseCenter = pushVertex(
    positions,
    rowCenter(profile.geometryAnchor, body.direction, tangent, bitangent, firstRow),
  );
  const lastRow = profile.rows[profile.rows.length - 1]!;
  const topCenter = pushVertex(
    positions,
    rowCenter(profile.geometryAnchor, body.direction, tangent, bitangent, lastRow),
  );

  // Face identifiers for the lathe, matching what the shape actually is: the
  // whole base cap is one plane, each side facet is one plane running the full
  // height however many rows it crosses, and each triangle of the termination
  // fan is its own.
  const faceIds: number[] = [];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(baseCenter, next, segment);
    faceIds.push(0);
  }
  const baseCapTriangleCount = segments;

  for (let row = 0; row < profile.rows.length - 1; row += 1) {
    const currentStart = row * segments;
    const nextStart = (row + 1) * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      // One diagonal, always. The checkerboard that used to be here was meant
      // to break up a smooth lathe, but it only worked by giving neighbouring
      // triangles different normals — which is precisely the mosaic. With a
      // shared ring the quad is planar, so both of its triangles have the same
      // normal and the split direction is invisible.
      indices.push(a, b, c, b, d, c);
      faceIds.push(1 + segment, 1 + segment);
    }
  }

  const topStart = (profile.rows.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(topStart + segment, topStart + next, topCenter);
    faceIds.push(1 + segments + segment);
  }

  const sourceTriangleCount = indices.length / 3;
  return {
    meshVersion: 1,
    bodyId: body.id,
    hostBodyId: body.hostBodyId,
    lod,
    profile,
    positions,
    normals: computeNormals(positions, indices),
    faceIds,
    indices,
    sourceTriangleCount,
    visibleTriangleCount: sourceTriangleCount,
    removedTriangleCount: 0,
    baseCapTriangleCount,
    baseCapRemoved: false,
    occluderBodyIds: [],
    bounds: computeBounds(positions),
  };
}
