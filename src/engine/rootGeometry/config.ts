import type { TreeRootGeometryConfig } from './types';

export const DEFAULT_TREE_ROOT_GEOMETRY_CONFIG: TreeRootGeometryConfig = {
  rulesVersion: 'tree-root-geometry-v1.4.0',
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
    // Roots were hexagonal prisms at six, and read as flat angular spikes
    // lying on the soil rather than wood entering the ground.
    radialSegmentsByLod: {
      high: 10,
      medium: 9,
      low: 5,
    },
    axialStrideByLod: {
      high: 1,
      medium: 1,
      low: 2,
    },
    // The same wood as the trunk, deliberately: roots and trunk are drawn as
    // two meshes with one material, and the moment their surfaces differ the
    // eye reads two objects joined at the collar instead of one tree.
    bark: {
      lobeCount: 3,
      overtoneCount: 5,
      swellFrequency: 7.4,
    striationFrequency: 19,
    striationDepthRatio: 0.26,
      twist: 4.6,
      depth: 0.14,
      fadeRadius: 0.06,
    },
  },
  maximumVerticesByLod: {
    high: 1_100,
    medium: 850,
    low: 520,
  },
  maximumTrianglesByLod: {
    high: 1_700,
    medium: 1_300,
    low: 780,
  },
};
