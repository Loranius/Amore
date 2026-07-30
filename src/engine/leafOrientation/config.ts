import type { TreeLeafOrientationConfig } from './types';

export const DEFAULT_TREE_LEAF_ORIENTATION_CONFIG: TreeLeafOrientationConfig = {
  rulesVersion: 'tree-leaf-orientation-v1.1.0',
  orientationByLayer: {
    inner: {
      maximumTiltRad: 0.12,
      maximumFanRad: 0.14,
      maximumTwistRad: 0.16,
    },
    middle: {
      maximumTiltRad: 0.15,
      maximumFanRad: 0.2,
      maximumTwistRad: 0.22,
    },
    outer: {
      maximumTiltRad: 0.18,
      maximumFanRad: 0.25,
      maximumTwistRad: 0.28,
    },
  },
  frontFacingStrengthByLayer: {
    inner: 0.74,
    middle: 0.64,
    outer: 0.52,
  },
  minimumFrontFacingDot: 0.28,
  quantizationBands: 17,
};