import type { CrystalGeometryConfig } from './types';

export const DEFAULT_CRYSTAL_GEOMETRY_CONFIG: CrystalGeometryConfig = {
  // 1.4.0: the substrate became a quartz vein instead of a cut plate, the
  // monarch sinks into it, and the year crystals lean. Every one of those
  // changes the published mesh, so snapshots taken before it no longer
  // reproduce byte-for-byte — which is exactly what this number records.
  rulesVersion: '1.4.0',
  maxVertices: 18_000,
  maxTriangles: 30_000,
  hiddenFaceEpsilon: 0.002,
};
