import type { TreeGroundContactConfig } from './types';

export const DEFAULT_TREE_GROUND_CONTACT_CONFIG: TreeGroundContactConfig = {
  rulesVersion: 'tree-ground-contact-v1.0.0',
  burialDepthBaseRadiusRatio: 0.22,
  minimumBurialDepth: 0.018,
  maximumBurialDepth: 0.12,
  collarHeightBaseRadiusRatio: 0.72,
  collarBottomRadiusRatio: 1.42,
  collarTopRadiusRatio: 1.04,
  collarRadialSegmentsByLod: {
    high: 12,
    medium: 8,
    low: 6,
  },
};
