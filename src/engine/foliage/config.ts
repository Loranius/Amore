import type { TreeFoliageConfig } from './types';

export const DEFAULT_TREE_FOLIAGE_CONFIG: TreeFoliageConfig = {
  rulesVersion: 'tree-foliage-v1.0.0',
  minimumGeneration: 1,
  terminalStart: 0.58,
  maxClusters: 64,
  maxLeaves: 900,
  minLeavesPerCluster: 8,
  maxLeavesPerCluster: 18,
  minClusterRadius: 0.12,
  maxClusterRadius: 0.28,
  clustersByRole: {
    primary: 1,
    secondary: 2,
    twig: 3,
  },
};
