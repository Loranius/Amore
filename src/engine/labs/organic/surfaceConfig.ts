import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 3,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.28,
  junctionSurfaceRatio: 0.96,
  junctionFlare: 1.48,
  junctionSegmentsByLod: {
    high: 5,
    medium: 4,
    low: 2,
  },
  radialSegmentsByLod: {
    high: 10,
    medium: 7,
    low: 5,
  },
  axialStrideByLod: {
    high: 1,
    medium: 2,
    low: 4,
  },
};
