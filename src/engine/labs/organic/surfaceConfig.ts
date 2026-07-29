import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 3,
  minimumRadius: 0.004,
  junctionInsetRatio: 0.36,
  junctionSurfaceRatio: 0.92,
  junctionFlare: 1.3,
  junctionSegmentsByLod: {
    high: 3,
    medium: 2,
    low: 1,
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
