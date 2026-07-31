import type {
  ReefProductionMobileBudget,
  ReefProductionPhaseId,
} from './reefTypes';

export const REEF_PRODUCTION_ACCEPTANCE_RULES_VERSION = 'reef-production-acceptance-v1.0.0';

export const REEF_PRODUCTION_PIPELINE_PHASES: readonly ReefProductionPhaseId[] = [
  'reef-species',
  'colony-layout',
  'foundation-mesh',
  'morphotype-skeletons',
  'colony-meshes',
  'reef-materials',
  'reef-life',
  'three-renderer',
];

export const REEF_PRODUCTION_MOBILE_BUDGET: ReefProductionMobileBudget = {
  maxVertices: 24_256,
  maxTriangles: 36_512,
  maxBuildMs: 220,
  maxDrawCalls: 7,
  maxMaterials: 7,
};
