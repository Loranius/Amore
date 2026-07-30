import type { TreeFoliageConfig } from './types';

export const DEFAULT_TREE_FOLIAGE_CONFIG: TreeFoliageConfig = {
  rulesVersion: 'tree-foliage-v2.0.0',
  minimumGeneration: 1,
  terminalStart: 0.3,
  maxClusters: 64,
  maxLeaves: 900,
  minLeavesPerCluster: 12,
  maxLeavesPerCluster: 20,
  minClusterRadius: 0.14,
  maxClusterRadius: 0.3,
  clustersByRole: {
    primary: 2,
    secondary: 3,
    twig: 3,
  },
};
