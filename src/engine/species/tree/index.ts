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
  MAX_SCAFFOLD_BRANCHES,
  SCAFFOLD_FIRST_YEAR,
  addTreeScaffoldBranches,
  pruneThinTwigsForScaffolds,
  scaffoldCountFor,
} from './scaffold';
export {
  TREE_CROWN_BOTTOM_SHARE,
  TREE_CROWN_HALF_WIDTH_SHARE,
  TREE_CROWN_WIDEST_AT,
  applyTreeCrownEnvelope,
  treeCrownHalfWidthAt,
  treeCrownRadiusShare,
} from './crownProfile';
export {
  TREE_ROOT_FLARE,
  TREE_ROOT_FLARE_SPAN,
  applyTreeRootFlare,
} from './rootFlare';
export {
  TREE_FOLIAGE_TUNED_HEIGHT,
  TREE_SKELETON_HEIGHT_PER_TRUNK,
  scaleFoliageConfigToAge,
  scaleLeafGeometryConfigToAge,
  scaleOrganicSurfaceToAge,
  scaleTreeSkeletonToAge,
  treeCrownNarrowing,
  treeSlenderness,
  treeDaysTogether,
  treeFoliageScale,
  treeAgeSizeShare,
  treeSkeletonTargetHeight,
} from './ageScale';
