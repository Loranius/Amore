import type { ReefColonyLayoutConfig } from './types';

export const DEFAULT_REEF_COLONY_LAYOUT_CONFIG: ReefColonyLayoutConfig = {
  rulesVersion: 'reef-colony-layout-v1.0.0',
  azimuthSectorCount: 24,
  maximumAttemptsPerColony: 24,
  maximumColoniesPerCell: 4,
  minimumClearanceRatio: 1.05,
  surfaceNormalStepRatio: 0.012,
  radialPaddingRatio: 0.025,
};
