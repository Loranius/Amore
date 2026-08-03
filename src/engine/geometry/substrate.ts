import { round6, seededUnit } from '../growth/math';
import type { GrowthBody } from '../growth';
import { rebuildCrystalMeshNormals } from './mesh';
import type {
  CrystalBodyProfile,
  CrystalMeshBounds,
  CrystalMeshData,
  CrystalProfileRow,
} from './types';

/**
 * The rock the druse stands in.
 *
 * ADR-0003 made every crystal free-standing with its base sunk below y=0 and
 * its cap intact rather than trimmed. That is only sound while something
 * actually occludes the underside — this is that something. It is published
 * as geometry rather than left to the scene so it always scales with the
 * druse it has to cover, and so the artifact is self-contained.
 */
export const CRYSTAL_SUBSTRATE_BODY_ID = 'crystal:substrate';

const SEGMENTS = 18;

/**
 * Lowest ring first so the solid closes. `t` is signed: negative fractions
 * scale by the buried depth, positive ones by the mound height above ground.
 * The two are sized independently because depth is dictated by how far the
 * crystals bury and height only by how the mound should read.
 */
const SHAPE: readonly { readonly t: number; readonly radius: number }[] = [
  { t: -1, radius: 0.5 },
  { t: -0.5, radius: 0.86 },
  { t: 0, radius: 1 },
  // The top used to fall away to 0.44 of the radius, which domed the earth
  // into a boulder with the crystals on top of it. It is soil the crystals
  // pushed through, not a hill they stand on, so the patch stays nearly flat
  // out to its rim and only rounds off at the very edge.
  { t: 0.55, radius: 0.94 },
  { t: 1, radius: 0.78 },
];

/**
 * How far the ground spreads beyond the druse's own footprint, from the
 * monarch's published attribute. Geometry reads a multiplier and nothing
 * more — it never learns that the number came from places the couple
 * visited.
 *
 * Defaults to 1 for species and older states that publish nothing, so this
 * can only ever widen the rock. That direction matters: the substrate must
 * stay wide enough to occlude every buried base (ADR-0003), and a multiplier
 * below 1 could break that.
 */
function groundSpreadOf(bodies: readonly GrowthBody[]): number {
  for (const body of bodies) {
    const published = body.attributes['groundSpread'];
    if (typeof published === 'number' && Number.isFinite(published) && published >= 1) {
      return Math.min(2, published);
    }
  }
  return 1;
}

function footprintRadius(bodies: readonly GrowthBody[]): number {
  let widest = 0;
  for (const body of bodies) {
    const horizontal = Math.hypot(body.anchor.x, body.anchor.z);
    widest = Math.max(widest, horizontal + body.renderedRadius * 1.25);
  }
  // Enough margin that no crystal stands on the very lip, but no more: a wide
  // apron reads as a plate the druse was placed on rather than ground it grew
  // out of.
  //
  // The margins were loosened when bodies were scattered per event. Under
  // ADR-0004 the druse is compact, and the same margins made the rock wider
  // than the monarch is tall — a boulder with crystals on it rather than the
  // other way round.
  return round6(Math.max(0.16, widest * 1.06 + 0.02) * groundSpreadOf(bodies));
}

function substrateProfile(radius: number, height: number, depth: number): CrystalBodyProfile {
  const rows: CrystalProfileRow[] = SHAPE.map((step) => ({
    y: round6(step.t < 0 ? step.t * depth : step.t * height),
    radius: round6(step.radius * radius),
    radiusX: round6(step.radius * radius),
    radiusZ: round6(step.radius * radius),
    centerOffsetX: 0,
    centerOffsetZ: 0,
    rotation: 0,
    facetPhase: 0,
  }));

  return {
    profileVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    archetype: 'substrate',
    lod: 'high',
    segments: SEGMENTS,
    extraSink: 0,
    geometryLength: round6(height + depth),
    geometryAnchor: { x: 0, y: 0, z: 0 },
    scaleX: 1,
    scaleZ: 1,
    twistTotal: 0,
    axisLeanX: 0,
    axisLeanZ: 0,
    burialStartY: 0,
    burialCompression: 1,
    rows,
    signature: `substrate:${radius.toFixed(4)}:${height.toFixed(4)}:${depth.toFixed(4)}`,
  };
}

function boundsOf(positions: readonly number[]): CrystalMeshBounds {
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
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
  }
  const center = {
    x: round6((minX + maxX) * 0.5),
    y: round6((minY + maxY) * 0.5),
    z: round6((minZ + maxZ) * 0.5),
  };
  let radius = 0;
  for (let offset = 0; offset < positions.length; offset += 3) {
    radius = Math.max(radius, Math.hypot(
      (positions[offset] ?? 0) - center.x,
      (positions[offset + 1] ?? 0) - center.y,
      (positions[offset + 2] ?? 0) - center.z,
    ));
  }
  return {
    min: { x: round6(minX), y: round6(minY), z: round6(minZ) },
    max: { x: round6(maxX), y: round6(maxY), z: round6(maxZ) },
    center,
    radius: round6(radius),
  };
}

/**
 * Builds the substrate as a closed lathe so it is a solid, not a shell — the
 * underside is genuinely capped, which is what lets the crystals keep their
 * own base caps hidden instead of relying on draw order.
 *
 * Returns null when there is nothing to stand on.
 */
export function buildCrystalSubstrateMesh(
  bodies: readonly GrowthBody[],
  artifactSeed: number,
): CrystalMeshData | null {
  if (bodies.length === 0) return null;

  const radius = footprintRadius(bodies);
  // A patch of soil, not a mound. At 0.22 of its radius the earth read as a
  // rock the druse was standing on; the crystals are supposed to have come up
  // through it, which they cannot look like they did while it is taller than
  // the part of them that shows below the shoulder.
  const height = round6(radius * 0.075);
  // Depth is not cosmetic. Every crystal keeps its base cap and sinks it below
  // y=0; if the rock stops short of the deepest of them, that cap is exposed
  // from below and ADR-0003's guarantee breaks. Size it from the actual
  // burials, with margin, rather than from the footprint alone.
  const deepestBurial = Math.min(0, ...bodies.map((body) => body.anchor.y));
  const depth = round6(Math.max(radius * 0.2, -deepestBurial + radius * 0.14));
  const profile = substrateProfile(radius, height, depth);

  const positions: number[] = [];
  const indices: number[] = [];

  for (let rowIndex = 0; rowIndex < profile.rows.length; rowIndex += 1) {
    const row = profile.rows[rowIndex]!;
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const angle = (segment / SEGMENTS) * Math.PI * 2;
      // Rock is lumpy. Both jitters are seeded so the same couple always gets
      // the same stone.
      const radial = 1 + (seededUnit(artifactSeed, `substrate:r:${rowIndex}:${segment}`) - 0.5) * 0.16;
      const lift = (seededUnit(artifactSeed, `substrate:y:${rowIndex}:${segment}`) - 0.5) * height * 0.3;
      // sin on x and cos on z, not the other way round. The index winding below
      // is copied from buildCrystalMesh, and that builder lays its rings out in
      // the tangent/bitangent basis of the body axis — a basis with the opposite
      // handedness to (cos → x, sin → z). Sharing the winding while flipping the
      // ring turned every face inside out: back-face culling then removed the
      // outer shell and left the interior showing, which is both a crater
      // instead of a mound and a hole in the ADR-0003 guarantee that the rock
      // occludes each crystal's base cap.
      positions.push(
        round6(Math.sin(angle) * row.radiusX * radial),
        round6(row.y + lift),
        round6(Math.cos(angle) * row.radiusZ * radial),
      );
    }
  }

  const bottomCenter = positions.length / 3;
  positions.push(0, round6(profile.rows[0]!.y - depth * 0.12), 0);
  const topCenter = positions.length / 3;
  positions.push(0, round6(height + height * 0.06), 0);

  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const next = (segment + 1) % SEGMENTS;
    indices.push(bottomCenter, next, segment);
  }
  const baseCapTriangleCount = SEGMENTS;

  for (let row = 0; row < profile.rows.length - 1; row += 1) {
    const currentStart = row * SEGMENTS;
    const nextStart = (row + 1) * SEGMENTS;
    for (let segment = 0; segment < SEGMENTS; segment += 1) {
      const next = (segment + 1) % SEGMENTS;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      indices.push(a, b, c, b, d, c);
    }
  }

  const topStart = (profile.rows.length - 1) * SEGMENTS;
  for (let segment = 0; segment < SEGMENTS; segment += 1) {
    const next = (segment + 1) % SEGMENTS;
    indices.push(topStart + segment, topStart + next, topCenter);
  }

  const triangleCount = indices.length / 3;
  return rebuildCrystalMeshNormals({
    meshVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    hostBodyId: null,
    lod: 'high',
    profile,
    positions,
    normals: [],
    indices,
    sourceTriangleCount: triangleCount,
    visibleTriangleCount: triangleCount,
    removedTriangleCount: 0,
    baseCapTriangleCount,
    baseCapRemoved: false,
    occluderBodyIds: [],
    bounds: boundsOf(positions),
  });
}
