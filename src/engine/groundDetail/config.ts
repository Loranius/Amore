import type { TreeGroundDetailConfig } from './types';

export const DEFAULT_TREE_GROUND_DETAIL_CONFIG: TreeGroundDetailConfig = {
  rulesVersion: 'tree-ground-detail-v1.0.0',
  maximumInstancesByKindByLod: {
    high: { stone: 36, 'fallen-leaf': 36, moss: 36 },
    medium: { stone: 24, 'fallen-leaf': 24, moss: 24 },
    low: { stone: 12, 'fallen-leaf': 12, moss: 12 },
  },
  innerRadiusRatio: 0.3,
  outerRadiusRatio: 0.92,
  radialJitterRatio: 0.035,
  maximumTemplateVertices: 16,
  maximumTemplateTriangles: 24,
  colorQuantizationSteps: 16,
};
