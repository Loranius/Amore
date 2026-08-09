import type {
  CrystalCompositionConfig,
  TreeCompositionConfig,
} from './types';

export const DEFAULT_CRYSTAL_COMPOSITION_CONFIG: CrystalCompositionConfig = {
  // 1.1.0: a body's role comes from its tier alone. `generation === 0` used to
  // stand in for "the monarch" and stopped being true when children became
  // ground-rooted — every body in a crystal colony has generation 0, so every
  // body came out `focal` and the hierarchy below it was unreachable.
  rulesVersion: '1.1.0',
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
