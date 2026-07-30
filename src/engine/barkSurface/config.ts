import type { TreeBarkSurfaceConfig } from './types';

export const DEFAULT_TREE_BARK_SURFACE_CONFIG: TreeBarkSurfaceConfig = {
  rulesVersion: 'tree-bark-surface-v1.0.0',
  quantizationSteps: 16,
  toneBands: 8,
  roughnessBands: 8,
  maximumUniqueTints: 96,
  trunkBaseDarkening: 0.1,
  youngBranchLightening: 0.09,
  longitudinalVariation: 0.08,
  radialGrooveStrength: 0.07,
  roughnessMinimum: 0.72,
  roughnessMaximum: 1,
};
