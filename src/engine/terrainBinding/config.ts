import type { TreeTerrainBindingConfig } from './types';

export const DEFAULT_TREE_TERRAIN_BINDING_CONFIG: TreeTerrainBindingConfig = {
  rulesVersion: 'tree-terrain-binding-v1.0.0',
  radialSegmentsByLod: {
    high: 32,
    medium: 24,
    low: 16,
  },
  ringCountByLod: {
    high: 7,
    medium: 6,
    low: 4,
  },
  surfaceRadiusRootCoverageRatio: 1.22,
  minimumSurfaceRadiusBaseRatio: 6,
  plateauRootCoverageRatio: 1.05,
  reliefAmplitudeBaseRadiusRatio: 0.12,
  maximumVerticesByLod: {
    high: 240,
    medium: 170,
    low: 80,
  },
  maximumTrianglesByLod: {
    high: 440,
    medium: 300,
    low: 140,
  },
};
