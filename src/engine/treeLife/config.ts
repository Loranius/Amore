import type { TreeLifeConfig } from './types';

export const DEFAULT_TREE_LIFE_CONFIG: TreeLifeConfig = {
  rulesVersion: 'tree-life-v1.0.0',
  reducedMotion: false,
  motionScaleByLod: {
    high: 1,
    medium: 0.72,
    low: 0.46,
  },
  maxLeafProfiles: 900,
};
