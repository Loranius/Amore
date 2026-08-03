import {
  add,
  cross,
  length,
  normalize,
  orthonormalBasis,
  round6,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import type { GrowthBody, GrowthVec3 } from '../growth';
import { buildCrystalProfile } from './profile';
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
export function splitCrystalMeshFaces(mesh: CrystalMeshData): CrystalMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const corners = [
      vertexAt(mesh.positions, mesh.indices[offset] ?? 0),
      vertexAt(mesh.positions, mesh.indices[offset + 1] ?? 0),
      vertexAt(mesh.positions, mesh.indices[offset + 2] ?? 0),
    ] as const;
    const face = normalize(cross(
      subtract(corners[1], corners[0]),
      subtract(corners[2], corners[0]),
    ));
    for (const corner of corners) {
      indices.push(pushVertex(positions, corner));
      normals.push(round6(face.x), round6(face.y), round6(face.z));
    }
  }

  return {
    ...mesh,
    positions,
    normals,
    indices,
    // Bounds are unchanged in principle — the same points, listed more times —
    // but recomputing keeps the published state self-consistent rather than
    // asking a reader to trust that.
    bounds: computeBounds(positions),
  };
}

/** Pure indexed mesh builder; no THREE, canvas, renderer or material imports. */
export function buildCrystalMesh(body: GrowthBody, lod: CrystalLodLevel): CrystalMeshData {
  const profile = buildCrystalProfile(body, lod);
  const { tangent, bitangent } = orthonormalBasis(body.direction);
  const positions: number[] = [];
  const indices: number[] = [];
  const segments = profile.segments;

  for (let rowIndex = 0; rowIndex < profile.rows.length; rowIndex += 1) {
    const row = profile.rows[rowIndex]!;
    const center = rowCenter(
      profile.geometryAnchor,
      body.direction,
      tangent,
      bitangent,
      row,
    );
    const angleStep = (Math.PI * 2) / segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const facetAngleJitter = (seededUnit(body.seed, `geometry:facet-angle:${segment}`) - 0.5)
        * angleStep * 0.28;
      const rowAngleJitter = (seededUnit(body.seed, `geometry:facet-angle-row:${rowIndex}:${segment}`) - 0.5)
        * angleStep * 0.07;
      const angle = segment * angleStep + facetAngleJitter + rowAngleJitter
        + row.rotation + row.facetPhase;
      const facetJitter = seededUnit(body.seed, `geometry:facet:${segment}`) - 0.5;
      const rowJitter = seededUnit(body.seed, `geometry:facet-row:${rowIndex}:${segment}`) - 0.5;
      const jitter = 1 + facetJitter * 0.07 + rowJitter * 0.026;
      const radial = add(
        scale(tangent, Math.cos(angle) * row.radiusX * jitter),
        scale(bitangent, Math.sin(angle) * row.radiusZ * jitter),
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

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(baseCenter, next, segment);
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
      // Alternating the diagonal is what turns a lathe into something faceted.
      // Splitting every quad the same way gave every triangle in the body the
      // same pair of edge directions, so the whole surface caught the light at
      // one angle and the crystal read as a smooth spun shape. A checkerboard
      // makes neighbouring triangles lean opposite ways, and once each face
      // carries its own normal (see the flat-shading pass below) that is what
      // the eye reads as facets.
      //
      // An odd segment count would put two same-parity quads next to each other
      // at the seam. That is a mild defect in the pattern, not in the mesh —
      // both splits are valid triangulations of the same quad and wind the same
      // way, so the shell stays closed and consistently oriented either way.
      if ((row + segment) % 2 === 0) {
        indices.push(a, b, c, b, d, c);
      } else {
        indices.push(a, b, d, a, d, c);
      }
    }
  }

  const topStart = (profile.rows.length - 1) * segments;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(topStart + segment, topStart + next, topCenter);
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
