import type { TreeCrownSilhouetteConfig } from './types';

export const DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG: TreeCrownSilhouetteConfig = {
  rulesVersion: 'tree-crown-silhouette-v1.0.0',
  azimuthSectorCount: 16,
  verticalBandCount: 5,
  maximumRadialOffsetRatio: 0.035,
  maximumScaleDelta: 0.04,
  envelopeResponse: 0.58,
};
