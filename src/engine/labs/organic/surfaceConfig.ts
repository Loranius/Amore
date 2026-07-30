import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 3,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.24,
  junctionSurfaceRatio: 0.98,
  junctionFlare: 1.56,
  junctionSegmentsByLod: {
    high: 5,
    medium: 5,
    low: 3,
  },
  radialSegmentsByLod: {
    high: 10,
    medium: 9,
    low: 6,
  },
  axialStrideByLod: {
    high: 1,
    medium: 1,
    low: 3,
  },
};
