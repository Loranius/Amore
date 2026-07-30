import type { TreeCanopyDepthConfig } from './types';

export const DEFAULT_TREE_CANOPY_DEPTH_CONFIG: TreeCanopyDepthConfig = {
  rulesVersion: 'tree-canopy-depth-v1.0.0',
  innerDepthMaximum: 0.38,
  outerDepthMinimum: 0.7,
  maximumOffsetRatio: 0.12,
  scaleByLayer: {
    inner: 0.9,
    middle: 1,
    outer: 1.08,
  },
  tintByLayer: {
    inner: { r: 0.8, g: 0.86, b: 0.78 },
    middle: { r: 0.92, g: 0.96, b: 0.9 },
    outer: { r: 1, g: 1, b: 0.96 },
  },
  quantizationSteps: 16,
  maximumUniqueTints: 24,
};
