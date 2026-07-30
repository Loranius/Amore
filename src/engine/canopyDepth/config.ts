import type { TreeCanopyDepthConfig } from './types';

export const DEFAULT_TREE_CANOPY_DEPTH_CONFIG: TreeCanopyDepthConfig = {
  rulesVersion: 'tree-canopy-depth-v1.2.0',
  innerDepthMaximum: 0.38,
  outerDepthMinimum: 0.7,
  maximumOffsetRatio: 0.22,
  presentationFrontDirection: { x: 0.6, y: 0, z: 0.8 },
  frontFillFraction: 0.78,
  frontBiasRatio: 0.88,
  frontFillDepthRatio: 0.14,
  scaleByLayer: {
    inner: 1.14,
    middle: 1.3,
    outer: 1.2,
  },
  tintByLayer: {
    inner: { r: 0.8, g: 0.86, b: 0.78 },
    middle: { r: 0.92, g: 0.96, b: 0.9 },
    outer: { r: 1, g: 1, b: 0.96 },
  },
  quantizationSteps: 16,
  maximumUniqueTints: 24,
};