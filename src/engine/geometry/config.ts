import type { CrystalGeometryConfig } from './types';

export const DEFAULT_CRYSTAL_GEOMETRY_CONFIG: CrystalGeometryConfig = {
  // 1.10.0: the termination became lattice rather than proportion. The crown
  // angle is the mineral's own 51.78° instead of an aspect-derived value
  // clamped into a 42–54° band, and alternate crown planes stand back as minor
  // rhombohedral faces instead of every plane meeting at one apex. Every
  // terminated body changes shape; the shoulder rises about 8%.
  //
  // 1.5.0: the crystal stopped being a lathe (ADR-0006). It is now the
  // intersection of a seeded set of half-spaces, so `rows` became a report of
  // the shape rather than the recipe for it and `planes` is the shape. Every
  // published mesh changes; snapshots taken before it no longer reproduce.
  //
  // 1.4.0: the substrate became a quartz vein instead of a cut plate, the
  // monarch sinks into it, and the year crystals lean.
  rulesVersion: '1.10.0',
  maxVertices: 18_000,
  maxTriangles: 30_000,
  hiddenFaceEpsilon: 0.002,
};
