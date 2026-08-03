import type { CrystalGeometryConfig } from './types';

export const DEFAULT_CRYSTAL_GEOMETRY_CONFIG: CrystalGeometryConfig = {
  // 1.5.0: the crystal stopped being a lathe (ADR-0006). It is now the
  // intersection of a seeded set of half-spaces, so `rows` became a report of
  // the shape rather than the recipe for it and `planes` is the shape. Every
  // published mesh changes; snapshots taken before it no longer reproduce.
  //
  // 1.4.0: the substrate became a quartz vein instead of a cut plate, the
  // monarch sinks into it, and the year crystals lean.
  rulesVersion: '1.8.0',
  maxVertices: 18_000,
  maxTriangles: 30_000,
  hiddenFaceEpsilon: 0.002,
};
