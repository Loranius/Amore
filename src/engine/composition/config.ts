import type {
  CrystalCompositionConfig,
  TreeCompositionConfig,
} from './types';

export const DEFAULT_CRYSTAL_COMPOSITION_CONFIG: CrystalCompositionConfig = {
  rulesVersion: '1.0.0',
  sectorCount: 8,
  targetEmptySectorShare: 0.375,
};

export const DEFAULT_TREE_COMPOSITION_CONFIG: TreeCompositionConfig = {
  rulesVersion: 'tree-composition-v1.0.0',
  azimuthSectorCount: 8,
  verticalLayerCount: 4,
  targetEmptySectorShare: 0.25,
  targetCrownFill: 0.5,
};
