import { round6 } from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type { CrystalFacePlane } from './types';

/**
 * The convex solid a set of half-spaces cuts out.
 *
 * By vertex enumeration rather than incremental clipping: every triple of
 * planes is solved for its intersection point, and a point is a vertex of the
 * solid exactly when it satisfies every other plane. With fifteen or so planes
 * that is 455 three-by-three solves — nothing — and unlike successive clipping
 * it has no partially-clipped intermediate state to get wrong. Determinism
 * comes for free: no ordering decision changes the answer.
 *
 * The property that matters downstream: a face here is the set of vertices
 * lying *on* one plane, so it is exactly planar. Any triangulation of it —
 * however lopsided the polygon — gives triangles that share one normal. That is
 * what lets the crystal be as unequal as a real one without ever returning to
 * the mosaic of small mismatched triangles that visual review rejected.
 */

export interface CrystalPolytopeFace {
  /** Index into the plane list this face was cut by. */
  planeIndex: number;
  /** Vertex indices, counter-clockwise seen from outside. */
  loop: number[];
}

export interface CrystalPolytope {
  vertices: GrowthVec3[];
  faces: CrystalPolytopeFace[];
}

/** A vertex has to sit on its planes this closely, relative to the body size. */
const ON_PLANE = 1e-6;
/** Triples flatter than this are parallel enough to have no single crossing. */
const DEGENERATE_DET = 1e-9;

function solveTriple(
  a: CrystalFacePlane,
  b: CrystalFacePlane,
  c: CrystalFacePlane,
): GrowthVec3 | null {
  const m = [
    [a.normal.x, a.normal.y, a.normal.z],
    [b.normal.x, b.normal.y, b.normal.z],
    [c.normal.x, c.normal.y, c.normal.z],
  ] as const;
  const rhs = [a.offset, b.offset, c.offset] as const;

  const det = (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
  if (Math.abs(det) < DEGENERATE_DET) return null;

  const detFor = (column: 0 | 1 | 2): number => {
    const at = (row: 0 | 1 | 2, col: 0 | 1 | 2): number => (col === column ? rhs[row] : m[row][col]);
    return (
      at(0, 0) * (at(1, 1) * at(2, 2) - at(1, 2) * at(2, 1))
      - at(0, 1) * (at(1, 0) * at(2, 2) - at(1, 2) * at(2, 0))
      + at(0, 2) * (at(1, 0) * at(2, 1) - at(1, 1) * at(2, 0))
    );
  };

  return { x: detFor(0) / det, y: detFor(1) / det, z: detFor(2) / det };
}

/**
 * Drops corners that carry no shape: duplicates, and vertices sitting on the
 * straight line between their neighbours.
 *
 * Both are artifacts of the enumeration rather than features of the crystal.
 * Where three planes very nearly meet in a line or in a point, the solve puts
 * two corners a hair apart; fanning across them yields a triangle with an area
 * near zero and a normal made of pure noise — one facet lit as if it faced
 * somewhere else, which is exactly the mosaic the plane model exists to
 * prevent. Removing the corners removes the triangles, and leaves the face
 * closed; dropping the triangles instead would have left the shell with holes,
 * and clamping their normals would only have hidden them.
 */
function pruneLoop(
  loop: readonly number[],
  vertices: readonly GrowthVec3[],
  merge: number,
): number[] {
  const kept: number[] = [];
  for (const index of loop) {
    const point = vertices[index]!;
    const previous = kept.length > 0 ? vertices[kept[kept.length - 1]!]! : undefined;
    if (previous && Math.hypot(
      point.x - previous.x,
      point.y - previous.y,
      point.z - previous.z,
    ) <= merge) continue;
    kept.push(index);
  }
  while (kept.length >= 2) {
    const first = vertices[kept[0]!]!;
    const last = vertices[kept[kept.length - 1]!]!;
    if (Math.hypot(first.x - last.x, first.y - last.y, first.z - last.z) > merge) break;
    kept.pop();
  }

  // Collinear corners, removed until none is left. One pass is not enough: a
  // run of three collinear corners only reveals the middle one after an outer
  // one has gone.
  let changed = true;
  while (changed && kept.length > 3) {
    changed = false;
    for (let index = 0; index < kept.length; index += 1) {
      const before = vertices[kept[(index - 1 + kept.length) % kept.length]!]!;
      const here = vertices[kept[index]!]!;
      const after = vertices[kept[(index + 1) % kept.length]!]!;
      const ax = here.x - before.x;
      const ay = here.y - before.y;
      const az = here.z - before.z;
      const bx = after.x - here.x;
      const by = after.y - here.y;
      const bz = after.z - here.z;
      const cross = Math.hypot(
        ay * bz - az * by,
        az * bx - ax * bz,
        ax * by - ay * bx,
      );
      const lengths = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);
      if (lengths <= 0 || cross > lengths * COLLINEAR_SINE) continue;
      kept.splice(index, 1);
      changed = true;
      break;
    }
  }
  return kept;
}

/** sin of the turn a corner has to make to be worth keeping — about 0.06°. */
const COLLINEAR_SINE = 1e-3;

/**
 * Builds the solid. Returns null when the planes do not enclose anything —
 * which a caller must treat as a bug in the plane set rather than as a shape,
 * since a crystal with no volume is not a fallback anyone wants rendered.
 */
export interface CrystalPolytopeTolerance {
  /** How close a vertex has to sit to a plane to count as lying on its face. */
  onPlane: number;
  /**
   * How close two corners of one face may be before they are one corner.
   *
   * Deliberately much larger than `onPlane`, and a separate number rather than
   * a multiple of it: they answer different questions. `onPlane` is arithmetic
   * slack in a linear solve; this is a statement about the crystal — two
   * corners a thousandth of its radius apart are one corner, and treating them
   * as two produces a triangle with an area near zero whose normal is made of
   * rounding. Measured over 400 seeds, those triangles were up to 35° off the
   * face they belong to.
   */
  mergeCorners: number;
}

export function intersectHalfSpaces(
  planes: readonly CrystalFacePlane[],
  tolerance: CrystalPolytopeTolerance,
): CrystalPolytope | null {
  if (planes.length < 4) return null;
  const slack = Math.max(ON_PLANE, tolerance.onPlane);
  const merge = Math.max(slack, tolerance.mergeCorners);

  // Candidate vertices, deduplicated on their rounded coordinates so a corner
  // where four or more planes meet is one vertex rather than several within a
  // rounding of each other.
  const byKey = new Map<string, GrowthVec3>();
  for (let i = 0; i < planes.length; i += 1) {
    for (let j = i + 1; j < planes.length; j += 1) {
      for (let k = j + 1; k < planes.length; k += 1) {
        const point = solveTriple(planes[i]!, planes[j]!, planes[k]!);
        if (point === null) continue;
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) {
          continue;
        }
        let inside = true;
        for (const other of planes) {
          const distance = other.normal.x * point.x
            + other.normal.y * point.y
            + other.normal.z * point.z
            - other.offset;
          if (distance > slack) { inside = false; break; }
        }
        if (!inside) continue;
        const rounded = { x: round6(point.x), y: round6(point.y), z: round6(point.z) };
        byKey.set(`${rounded.x}|${rounded.y}|${rounded.z}`, rounded);
      }
    }
  }

  // Sorted so the vertex list is a function of the plane set alone, never of
  // the order the map happened to fill in.
  const keys = [...byKey.keys()].sort();
  const vertices = keys.map((key) => byKey.get(key)!);
  if (vertices.length < 4) return null;

  const faces: CrystalPolytopeFace[] = [];
  for (let index = 0; index < planes.length; index += 1) {
    const plane = planes[index]!;
    const onPlane: number[] = [];
    for (let vertex = 0; vertex < vertices.length; vertex += 1) {
      const point = vertices[vertex]!;
      const distance = Math.abs(
        plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z
        - plane.offset,
      );
      if (distance <= slack) onPlane.push(vertex);
    }
    if (onPlane.length < 3) continue;

    // Order them around the face. `u` is any direction in the plane and
    // `v = n × u`, so `u × v = n` — which means counter-clockwise in (u, v) is
    // counter-clockwise seen from outside, and the triangles come out with the
    // plane's own normal without a winding fix-up anywhere.
    const axis = Math.abs(plane.normal.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const ux = plane.normal.y * axis.z - plane.normal.z * axis.y;
    const uy = plane.normal.z * axis.x - plane.normal.x * axis.z;
    const uz = plane.normal.x * axis.y - plane.normal.y * axis.x;
    const uLength = Math.hypot(ux, uy, uz) || 1;
    const u = { x: ux / uLength, y: uy / uLength, z: uz / uLength };
    const v = {
      x: plane.normal.y * u.z - plane.normal.z * u.y,
      y: plane.normal.z * u.x - plane.normal.x * u.z,
      z: plane.normal.x * u.y - plane.normal.y * u.x,
    };

    let cx = 0; let cy = 0; let cz = 0;
    for (const vertex of onPlane) {
      const point = vertices[vertex]!;
      cx += point.x; cy += point.y; cz += point.z;
    }
    cx /= onPlane.length; cy /= onPlane.length; cz /= onPlane.length;

    const loop = [...onPlane].sort((left, right) => {
      const a = vertices[left]!;
      const b = vertices[right]!;
      const angleA = Math.atan2(
        (a.x - cx) * v.x + (a.y - cy) * v.y + (a.z - cz) * v.z,
        (a.x - cx) * u.x + (a.y - cy) * u.y + (a.z - cz) * u.z,
      );
      const angleB = Math.atan2(
        (b.x - cx) * v.x + (b.y - cy) * v.y + (b.z - cz) * v.z,
        (b.x - cx) * u.x + (b.y - cy) * u.y + (b.z - cz) * u.z,
      );
      // Ties broken on the vertex index so the loop is deterministic even when
      // two corners land at the same bearing from the centroid.
      return angleA - angleB || left - right;
    });

    const cleaned = pruneLoop(loop, vertices, merge);
    if (cleaned.length < 3) continue;
    faces.push({ planeIndex: index, loop: cleaned });
  }

  return faces.length >= 4 ? { vertices, faces } : null;
}

/**
 * The tolerances a body of this radius should be cut at.
 *
 * One place, because the profile and the mesh solve the same polytope and a
 * crystal whose envelope was measured at one tolerance and drawn at another
 * would have an envelope that does not contain it.
 */
export function polytopeTolerance(radius: number): CrystalPolytopeTolerance {
  const size = Math.max(1e-6, radius);
  return { onPlane: ON_PLANE_SLACK, mergeCorners: size * CORNER_MERGE };
}

/**
 * Absolute, not proportional to the body.
 *
 * Vertices are solved exactly and then rounded to six places, so a vertex that
 * genuinely lies on a plane is at most a couple of roundings away from it —
 * whatever the crystal's size. A proportional slack was letting the monarch
 * admit vertices 7e-6 off a face, and a face is only as flat as the vertices it
 * was handed: those triangles came out nearly two degrees off their own plane.
 */
const ON_PLANE_SLACK = 4e-6;

/** Corners closer than this share of the body radius are one corner. */
const CORNER_MERGE = 5e-3;
