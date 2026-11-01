export { buildTreeSpeciesBlueprint } from './treeSpecies';
export {
  DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG,
  treeToOrganicField,
  type TreeOrganicAdapterConfig,
  type TreeOrganicField,
  type TreeOrganicFieldDiagnostics,
} from './organicAdapter';
export {
  TREE_LIFE_STAGES,
  type BuildTreeSpeciesBlueprintInput,
  type TreeBranchKind,
  type TreeBranchTier,
  type TreeGrowthInstruction,
  type TreeLifeStage,
  type TreeSpeciesBlueprint,
  type TreeSpeciesConfig,
  type TreeSpeciesDiagnostics,
  type TreeSpeciesPressures,
  type TreeSpeciesState,
  type TreeStructureInstruction,
} from './types';
export {
  addTreeScaffoldBranches,
  extendTreeLeaderToTop,
  pruneThinTwigsForScaffolds,
} from './scaffold';
export {
  TREE_CROWN_BOTTOM_SHARE,
  TREE_CROWN_HALF_WIDTH_SHARE,
  TREE_CROWN_WIDEST_AT,
  applyTreeCrownEnvelope,
  treeCrownHalfWidthAt,
} from './crownProfile';
export {
  applyTreeRootFlare,
} from './rootFlare';
export {
  scaleFoliageConfigToAge,
  scaleLeafGeometryConfigToAge,
  scaleOrganicSurfaceToAge,
  scaleTreeSkeletonToAge,
  treeCrownNarrowing,
  treeSlenderness,
  treeDaysTogether,
  treeFoliageScale,
  treeSkeletonTargetHeight,
} from './ageScale';
