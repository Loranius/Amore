import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 4,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.24,
  junctionSurfaceRatio: 0.98,
  junctionFlare: 1.56,
  junctionSegmentsByLod: {
    high: 4,
    medium: 5,
    low: 3,
  },
  // Raised with the bark relief. A ring of ten described the lobes badly enough
  // that they aliased into a gear on the trunk; the relief needs roughly four
  // vertices per lobe, and the trunk carries three lobes plus an overtone.
  radialSegmentsByLod: {
    high: 14,
    medium: 13,
    low: 7,
  },
  axialStrideByLod: {
    high: 1,
    medium: 1,
    low: 3,
  },
  bark: {
    lobeCount: 3,
    overtoneCount: 5,
    swellFrequency: 7.4,
    twist: 4.6,
    depth: 0.14,
    fadeRadius: 0.06,
  },
};
