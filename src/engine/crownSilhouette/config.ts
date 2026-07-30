import type { TreeCrownSilhouetteConfig } from './types';

export const DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG: TreeCrownSilhouetteConfig = {
  rulesVersion: 'tree-crown-silhouette-v1.1.0',
  azimuthSectorCount: 16,
  verticalBandCount: 5,
  maximumRadialOffsetRatio: 0.055,
  maximumScaleDelta: 0.07,
  envelopeResponse: 0.7,
  middleLayerResponse: 0.38,
  frontClosureScaleDelta: 0.05,
  viewDirectionCount: 8,
  minimumReadableFacingDot: 0.16,
  minimumReadableLeafFraction: 0.1,
};