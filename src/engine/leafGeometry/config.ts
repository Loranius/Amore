import type { TreeLeafGeometryConfig } from './types';

export const DEFAULT_TREE_LEAF_GEOMETRY_CONFIG: TreeLeafGeometryConfig = {
  rulesVersion: '1.0.0',
  renderFractionByLod: {
    high: 1,
    medium: 0.58,
    low: 0.3,
  },
  maxInstancesByLod: {
    high: 900,
    medium: 520,
    low: 260,
  },
  minimumLength: 0.12,
  maximumLength: 0.3,
  minimumWidthRatio: 0.38,
  maximumWidthRatio: 0.58,
  radialSpread: 0.76,
  axialSpread: 0.52,
};
