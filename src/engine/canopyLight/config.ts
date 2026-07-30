import type { TreeCanopyLightConfig } from './types';

export const DEFAULT_TREE_CANOPY_LIGHT_CONFIG: TreeCanopyLightConfig = {
  rulesVersion: 'tree-canopy-light-v1.0.0',
  lightDirection: { x: 4, y: 7, z: 5 },
  ambientFloor: 0.68,
  sideInfluence: 0.48,
  facingInfluence: 0.22,
  heightInfluence: 0.12,
  layerInfluence: 0.18,
  layerExposureByLayer: {
    inner: 0.32,
    middle: 0.68,
    outer: 1,
  },
  shadowPenaltyByLayer: {
    inner: 0.06,
    middle: 0.02,
    outer: 0,
  },
  shadeMaximum: 0.76,
  sunlitMinimum: 0.9,
  exposureBands: 8,
  tintByBand: {
    shade: { r: 0.76, g: 0.82, b: 0.84 },
    transition: { r: 0.9, g: 0.93, b: 0.9 },
    sunlit: { r: 1, g: 0.98, b: 0.92 },
  },
  quantizationSteps: 16,
  maximumUniqueCombinedTints: 72,
};
