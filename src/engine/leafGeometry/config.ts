import type { TreeLeafGeometryConfig } from './types';

export const DEFAULT_TREE_LEAF_GEOMETRY_CONFIG: TreeLeafGeometryConfig = {
  rulesVersion: 'tree-leaf-geometry-v1.1.0',
  renderFractionByLod: {
    high: 1,
    medium: 0.76,
    low: 0.34,
  },
  maxInstancesByLod: {
    high: 900,
    medium: 720,
    low: 360,
  },
  minimumLength: 0.14,
  maximumLength: 0.32,
  minimumWidthRatio: 0.42,
  maximumWidthRatio: 0.62,
  radialSpread: 0.76,
  axialSpread: 0.58,
};
