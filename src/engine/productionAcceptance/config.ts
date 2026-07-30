import type {
  TreeProductionMobileBudget,
  TreeProductionPhaseId,
} from './types';

export const TREE_PRODUCTION_ACCEPTANCE_RULES_VERSION = 'tree-production-acceptance-v1.2.0';

export const TREE_PRODUCTION_PIPELINE_PHASES: readonly TreeProductionPhaseId[] = [
  'tree-species',
  'organic-skeleton',
  'curve-frames',
  'tree-composition',
  'root-architecture',
  'ground-contact',
  'terrain-binding',
  'root-geometry',
  'foliage-architecture',
  'leaf-geometry',
  'tree-material',
  'canopy-depth',
  'canopy-light',
  'phenology',
  'leaf-orientation',
  'crown-silhouette',
  'soil-surface',
  'bark-surface',
  'ground-detail',
  'tree-life',
];

export const TREE_PRODUCTION_MOBILE_BUDGET: TreeProductionMobileBudget = {
  maxVertices: 12_000,
  maxTriangles: 16_000,
  maxBuildMs: 220,
  maxDrawCalls: 4,
  maxMaterials: 3,
};

export const TREE_PRODUCTION_HIGH_DETAIL_BUDGET: TreeProductionMobileBudget = {
  ...TREE_PRODUCTION_MOBILE_BUDGET,
  maxTriangles: 18_000,
};
