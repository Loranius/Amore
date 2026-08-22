import type { TreeCrownSilhouetteConfig } from './types';

export const DEFAULT_TREE_CROWN_SILHOUETTE_CONFIG: TreeCrownSilhouetteConfig = {
  rulesVersion: 'tree-crown-silhouette-v1.3.0',
  azimuthSectorCount: 16,
  verticalBandCount: 5,
  maximumRadialOffsetRatio: 0.055,
  // Keep the branch hierarchy readable instead of inflating hundreds of
  // cards into two solid polygonal clouds around the main fork.
  maximumScaleDelta: 0.24,
  envelopeResponse: 0.7,
  middleLayerResponse: 0.18,
  frontClosureSelectionFraction: 0.68,
  frontClosureTargetRadialRatio: 0.5,
  frontClosureMaximumInwardOffsetRatio: 0.1,
  frontClosureScaleDelta: 0.18,
  viewDirectionCount: 8,
  minimumReadableFacingDot: 0.16,
  minimumReadableLeafFraction: 0.1,
};
