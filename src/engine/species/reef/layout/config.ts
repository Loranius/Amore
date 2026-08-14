import type { ReefColonyLayoutConfig } from './types';

export const DEFAULT_REEF_COLONY_LAYOUT_CONFIG: ReefColonyLayoutConfig = {
  rulesVersion: 'reef-colony-layout-v1.1.0',
  azimuthSectorCount: 24,
  maximumAttemptsPerColony: 48,
  maximumColoniesPerCell: 4,
  minimumClearanceRatio: 2.15,
  surfaceNormalStepRatio: 0.012,
  radialPaddingRatio: 0.025,
};
