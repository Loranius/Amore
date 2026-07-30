import type { TreeLeafOrientationConfig } from './types';

export const DEFAULT_TREE_LEAF_ORIENTATION_CONFIG: TreeLeafOrientationConfig = {
  rulesVersion: 'tree-leaf-orientation-v1.2.0',
  orientationByLayer: {
    inner: {
      maximumTiltRad: 0.1,
      maximumFanRad: 0.12,
      maximumTwistRad: 0.14,
    },
    middle: {
      maximumTiltRad: 0.13,
      maximumFanRad: 0.17,
      maximumTwistRad: 0.19,
    },
    outer: {
      maximumTiltRad: 0.16,
      maximumFanRad: 0.21,
      maximumTwistRad: 0.24,
    },
  },
  frontFacingStrengthByLayer: {
    inner: 0.9,
    middle: 0.86,
    outer: 0.78,
  },
  minimumFrontFacingDot: 0.4,
  quantizationBands: 17,
};