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
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2 + row.rotation + row.facetPhase;
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
      indices.push(a, b, c, b, d, c);
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
