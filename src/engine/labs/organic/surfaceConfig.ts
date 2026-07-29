import type { OrganicSurfaceConfig } from './surfaceTypes';

export const DEFAULT_ORGANIC_SURFACE_CONFIG: OrganicSurfaceConfig = {
  curveSamplesPerSegment: 3,
  minimumRadius: 0.004,
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
