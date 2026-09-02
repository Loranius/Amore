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
  TREE_FOLIAGE_TUNED_HEIGHT,
  TREE_SKELETON_HEIGHT_PER_TRUNK,
  scaleFoliageConfigToAge,
  scaleLeafGeometryConfigToAge,
  scaleOrganicSurfaceToAge,
  scaleTreeSkeletonToAge,
  treeFoliageScale,
  treeAgeSizeShare,
  treeSkeletonTargetHeight,
} from './ageScale';
