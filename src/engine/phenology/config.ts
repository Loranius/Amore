import type { TreePhenologyConfig } from './types';

export const DEFAULT_TREE_PHENOLOGY_CONFIG: TreePhenologyConfig = {
  rulesVersion: 'tree-phenology-v1.0.0',
  accentShareByPhase: {
    spring: 0.34,
    summer: 0.22,
    autumn: 0.48,
    winter: 0.16,
  },
  tintByPhase: {
    spring: { r: 0.92, g: 1, b: 0.8 },
    summer: { r: 0.96, g: 1, b: 0.88 },
    autumn: { r: 1, g: 0.72, b: 0.42 },
    winter: { r: 0.78, g: 0.86, b: 0.82 },
  },
  quantizationSteps: 16,
  maximumUniqueCombinedTints: 96,
};
