import type { TreeLeafOrientationConfig } from './types';

export const DEFAULT_TREE_LEAF_ORIENTATION_CONFIG: TreeLeafOrientationConfig = {
  rulesVersion: 'tree-leaf-orientation-v1.0.0',
  orientationByLayer: {
    inner: {
      maximumTiltRad: 0.08,
      maximumFanRad: 0.1,
      maximumTwistRad: 0.12,
    },
    middle: {
      maximumTiltRad: 0.11,
      maximumFanRad: 0.15,
      maximumTwistRad: 0.17,
    },
    outer: {
      maximumTiltRad: 0.15,
      maximumFanRad: 0.21,
      maximumTwistRad: 0.23,
    },
  },
  quantizationBands: 17,
};
