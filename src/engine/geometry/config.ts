import type { CrystalGeometryConfig } from './types';

export const DEFAULT_CRYSTAL_GEOMETRY_CONFIG: CrystalGeometryConfig = {
  rulesVersion: '1.1.0',
  maxVertices: 18_000,
  maxTriangles: 30_000,
  hiddenFaceEpsilon: 0.002,
};
