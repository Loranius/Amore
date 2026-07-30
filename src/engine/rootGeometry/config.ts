import type { TreeRootGeometryConfig } from './types';

export const DEFAULT_TREE_ROOT_GEOMETRY_CONFIG: TreeRootGeometryConfig = {
  rulesVersion: 'tree-root-geometry-v1.0.0',
  surface: {
    curveSamplesPerSegment: 1,
    minimumRadius: 0.008,
    junctionInsetRatio: 0.36,
    junctionSurfaceRatio: 0.92,
    junctionFlare: 1,
    junctionSegmentsByLod: {
      high: 1,
      medium: 1,
      low: 1,
    },
    radialSegmentsByLod: {
      high: 8,
      medium: 6,
      low: 4,
    },
    axialStrideByLod: {
      high: 1,
      medium: 1,
      low: 2,
    },
  },
  maximumVerticesByLod: {
    high: 800,
    medium: 650,
    low: 400,
  },
  maximumTrianglesByLod: {
    high: 1_200,
    medium: 950,
    low: 600,
  },
};
