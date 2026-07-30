import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 4,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.24,
  junctionSurfaceRatio: 0.98,
  junctionFlare: 1.56,
  junctionSegmentsByLod: {
    high: 6,
    medium: 5,
    low: 3,
  },
  radialSegmentsByLod: {
    high: 13,
    medium: 11,
    low: 6,
  },
  axialStrideByLod: {
    high: 1,
    medium: 1,
    low: 3,
  },
};
