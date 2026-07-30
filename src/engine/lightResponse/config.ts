import type { TreeLightResponseConfig } from './types';

export const DEFAULT_TREE_LIGHT_RESPONSE_CONFIG: TreeLightResponseConfig = {
  rulesVersion: 'tree-light-response-v1.0.0',
  lightDirection: { x: 0.46, y: 0.82, z: 0.34 },
  ambientFloor: 0.78,
  directStrength: 0.22,
  backlightLift: 0.035,
  quantizationSteps: 16,
  maximumUniqueTints: 16,
};
