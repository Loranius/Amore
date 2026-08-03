import {
  add,
  distance,
  dot,
  orthonormalBasis,
  scale,
  subtract,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import { rebuildCrystalMeshNormals } from './mesh';
import type {
  CrystalGeometryConfig,
  CrystalMeshData,
  CrystalSolid,
} from './types';

function vertexAt(positions: readonly number[], index: number): GrowthVec3 {
  return {
    x: positions[index * 3] ?? 0,
    y: positions[index * 3 + 1] ?? 0,
    z: positions[index * 3 + 2] ?? 0,
  };
}

function midpoint(left: GrowthVec3, right: GrowthVec3): GrowthVec3 {
  return scale(add(left, right), 0.5);
}

function centroid(a: GrowthVec3, b: GrowthVec3, c: GrowthVec3): GrowthVec3 {
  return scale(add(add(a, b), c), 1 / 3);
}

function boundsOverlap(left: CrystalSolid, right: CrystalSolid, epsilon: number): boolean {
  return distance(left.bounds.center, right.bounds.center)
    <= left.bounds.radius + right.bounds.radius + epsilon;
}

interface CrystalProfileSlice {
  centerOffsetX: number;
  centerOffsetZ: number;
  radiusX: number;
  radiusZ: number;
}

function sliceFromRow(
  row: CrystalSolid['profile']['rows'][number] | undefined,
  scaleX: number,
  scaleZ: number,
): CrystalProfileSlice {
  const legacyRadius = row?.radius ?? 0;
  return {
    centerOffsetX: row?.centerOffsetX ?? 0,
    centerOffsetZ: row?.centerOffsetZ ?? 0,
    radiusX: row?.radiusX ?? legacyRadius * scaleX,
    radiusZ: row?.radiusZ ?? legacyRadius * scaleZ,
  };
}

function interpolateSlice(
  left: CrystalProfileSlice,
  right: CrystalProfileSlice,
  t: number,
): CrystalProfileSlice {
  const mix = (a: number, b: number): number => a * (1 - t) + b * t;
  return {
    centerOffsetX: mix(left.centerOffsetX, right.centerOffsetX),
    centerOffsetZ: mix(left.centerOffsetZ, right.centerOffsetZ),
    radiusX: mix(left.radiusX, right.radiusX),
    radiusZ: mix(left.radiusZ, right.radiusZ),
  };
}

/** Samples the same bent elliptical shell used by buildCrystalMesh. */
function profileSliceAt(solid: CrystalSolid, y: number): CrystalProfileSlice {
  const rows = solid.profile.rows;
  const fromRow = (row: CrystalSolid['profile']['rows'][number] | undefined): CrystalProfileSlice => (
    sliceFromRow(row, solid.profile.scaleX, solid.profile.scaleZ)
  );
  if (y <= (rows[0]?.y ?? 0)) return fromRow(rows[0]);
  for (let index = 0; index < rows.length - 1; index += 1) {
    const left = rows[index]!;
    const right = rows[index + 1]!;
    if (y <= right.y) {
      const span = Math.max(1e-9, right.y - left.y);
      return interpolateSlice(fromRow(left), fromRow(right), (y - left.y) / span);
    }
  }
  return fromRow(rows[rows.length - 1]);
}

export function pointInsideCrystalSolid(
  point: GrowthVec3,
  solid: CrystalSolid,
  epsilon: number,
): boolean {
  const relative = subtract(point, solid.profile.geometryAnchor);
  const y = dot(relative, solid.body.direction);

  // Exact, when the body published what it was cut from (ADR-0006): a point is
  // inside a half-space intersection precisely when it satisfies every
  // half-space. No envelope, no interpolation, no conservatism to trade off.
  //
  // The elliptical-shell path below is the fallback for persisted Geometry
  // State v1 profiles, which carry rows and no planes. It stays because a
  // snapshot taken before this change still has to be readable.
  const planes = solid.profile.planes;
  if (planes !== undefined && planes.length > 0) {
    const { tangent: axisX, bitangent: axisZ } = orthonormalBasis(solid.body.direction);
    // The mesh maps local z through the negated bitangent to keep the frame
    // right-handed (see buildCrystalMesh); reading a point back has to undo
    // exactly that, or the test answers for a mirrored crystal.
    const local = {
      x: dot(relative, axisX),
      y,
      z: -dot(relative, axisZ),
    };
    for (const plane of planes) {
      const distance = plane.normal.x * local.x
        + plane.normal.y * local.y
        + plane.normal.z * local.z
        - plane.offset;
      if (distance > epsilon) return false;
    }
    return true;
  }

  const lastY = solid.profile.rows[solid.profile.rows.length - 1]?.y ?? 0;
  if (y < -epsilon || y > lastY + epsilon) return false;

  const { tangent, bitangent } = orthonormalBasis(solid.body.direction);
  const slice = profileSliceAt(solid, y);
  const axisPoint = add(
    add(
      add(solid.profile.geometryAnchor, scale(solid.body.direction, y)),
      scale(tangent, slice.centerOffsetX),
    ),
    scale(bitangent, slice.centerOffsetZ),
  );
  const radial = subtract(point, axisPoint);
  const radiusX = Math.max(1e-9, slice.radiusX);
  const radiusZ = Math.max(1e-9, slice.radiusZ);
  const x = dot(radial, tangent) / radiusX;
  const z = dot(radial, bitangent) / radiusZ;
  const allowance = 1 + epsilon / Math.min(radiusX, radiusZ);
  return x * x + z * z <= allowance * allowance;
}

function triangleInsideSolid(
  a: GrowthVec3,
  b: GrowthVec3,
  c: GrowthVec3,
  solid: CrystalSolid,
  epsilon: number,
): boolean {
  return pointInsideCrystalSolid(a, solid, epsilon)
    && pointInsideCrystalSolid(b, solid, epsilon)
    && pointInsideCrystalSolid(c, solid, epsilon)
    && pointInsideCrystalSolid(centroid(a, b, c), solid, epsilon)
    && pointInsideCrystalSolid(midpoint(a, b), solid, epsilon)
    && pointInsideCrystalSolid(midpoint(b, c), solid, epsilon)
    && pointInsideCrystalSolid(midpoint(c, a), solid, epsilon);
}

function minimumExposedTipRatio(solid: CrystalSolid): number {
  const body = solid.body;
  const role = body.growthCenterRole ?? null;
  if (body.generation === 0 || body.tier === 'king') return 0.66;
  if (role === 'dominant') return 0.52;
  if (role === 'satellite') return 0.32;
  if (role === 'micro' || body.tier === 'micro') return 0.18;
  return 0.28;
}

/**
 * Growth Centers deliberately intergrow, so analytical solids can overlap more
 * than their final visible shells should. Preserve a role-sensitive upper tip
 * band and only trim the lower/intersection portion of a body.
 */
function triangleTouchesProtectedTip(
  a: GrowthVec3,
  b: GrowthVec3,
  c: GrowthVec3,
  solid: CrystalSolid,
  epsilon: number,
): boolean {
  const lastY = solid.profile.rows[solid.profile.rows.length - 1]?.y ?? 0;
  const bodyStart = Math.min(lastY, Math.max(0, solid.profile.extraSink));
  const visibleSpan = Math.max(0, lastY - bodyStart);
  const protectedStartY = bodyStart + visibleSpan * (1 - minimumExposedTipRatio(solid));
  const center = centroid(a, b, c);
  const centerY = dot(subtract(center, solid.profile.geometryAnchor), solid.body.direction);
  return centerY >= protectedStartY - epsilon;
}

/**
 * Bounded local shell trim. Vertex buffers stay stable; only the visible index
 * list changes. Attached base caps are never part of the external shell.
 */
export function trimCrystalMesh(
  mesh: CrystalMeshData,
  self: CrystalSolid,
  solids: readonly CrystalSolid[],
  config: CrystalGeometryConfig,
): CrystalMeshData {
  const candidates = solids
    .filter((solid) => solid.body.id !== self.body.id && boundsOverlap(self, solid, config.hiddenFaceEpsilon))
    .sort((left, right) => left.body.id.localeCompare(right.body.id));
  const kept: number[] = [];
  const occluders = new Set<string>();
  let baseCapRemoved = false;

  for (let triangle = 0; triangle < mesh.sourceTriangleCount; triangle += 1) {
    const offset = triangle * 3;
    const ia = mesh.indices[offset] ?? 0;
    const ib = mesh.indices[offset + 1] ?? 0;
    const ic = mesh.indices[offset + 2] ?? 0;

    if (mesh.hostBodyId !== null && triangle < mesh.baseCapTriangleCount) {
      baseCapRemoved = true;
      if (mesh.hostBodyId) occluders.add(mesh.hostBodyId);
      continue;
    }

    const a = vertexAt(mesh.positions, ia);
    const b = vertexAt(mesh.positions, ib);
    const c = vertexAt(mesh.positions, ic);
    const protectedTip = triangleTouchesProtectedTip(
      a,
      b,
      c,
      self,
      config.hiddenFaceEpsilon,
    );
    const hiddenBy = protectedTip
      ? undefined
      : candidates.find((candidate) => triangleInsideSolid(
        a,
        b,
        c,
        candidate,
        config.hiddenFaceEpsilon,
      ));
    if (hiddenBy) {
      occluders.add(hiddenBy.body.id);
      continue;
    }
    kept.push(ia, ib, ic);
  }

  const visibleTriangleCount = kept.length / 3;
  return rebuildCrystalMeshNormals({
    ...mesh,
    indices: kept,
    visibleTriangleCount,
    removedTriangleCount: mesh.sourceTriangleCount - visibleTriangleCount,
    baseCapRemoved,
    occluderBodyIds: [...occluders].sort(),
  });
}
