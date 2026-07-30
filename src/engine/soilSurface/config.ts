import type { TreeSoilSurfaceConfig } from './types';

export const DEFAULT_TREE_SOIL_SURFACE_CONFIG: TreeSoilSurfaceConfig = {
  rulesVersion: 'tree-soil-surface-v1.0.0',
  quantizationSteps: 16,
  maximumUniqueTints: 64,
  plateauTint: { r: 0.82, g: 0.73, b: 0.6 },
  reliefTint: { r: 0.72, g: 0.64, b: 0.52 },
  edgeTint: { r: 0.62, g: 0.66, b: 0.54 },
  radialVariationStrength: 0.1,
  heightVariationStrength: 0.12,
};
