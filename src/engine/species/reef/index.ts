export { buildReefSpeciesBlueprint } from './reefSpecies';
export { buildReefModuleEvolution } from './moduleEvolution';
export { buildReefGrowthStructureLayout } from './structureGrowth';
export {
  buildReefCore,
  reefDaysTogether,
  REEF_CORE_MAX_DAYS,
  REEF_CORE_MAX_YEARS,
  REEF_CORE_SEED_NAMESPACE,
  REEF_CORE_VERSION,
  REEF_CORE_YEAR_DAYS,
} from './reefCore';
export type {
  ReefCoreAge,
  ReefCoreDimensions,
  ReefCoreIdentity,
  ReefCoreInput,
  ReefCoreManifest,
  ReefCoreMorphology,
  ReefCorePlatform,
} from './reefCore';
export {
  buildReefYearStructures,
  REEF_YEAR_GOLDEN_ANGLE_DEGREES,
  REEF_YEAR_GROWTH_DAYS,
  REEF_YEAR_PLACEMENT_ATTEMPTS,
  REEF_YEAR_STRUCTURES_VERSION,
} from './yearStructures';
export type {
  BuildReefYearStructuresInput,
  ReefYearStructure,
  ReefYearStructureArchetype,
  ReefYearStructurePoint,
  ReefYearStructureShape,
  ReefYearStructuresDiagnostics,
  ReefYearStructuresManifest,
} from './yearStructures';
export {
  buildReefComposition,
  scoreReefComposition,
  REEF_COMPOSITION_ACCEPT_SCORE,
  REEF_COMPOSITION_ATTEMPTS,
  REEF_COMPOSITION_VERSION,
  REEF_MIN_CORE_VISIBILITY,
} from './composition';
export type {
  BuildReefCompositionInput,
  ReefComposedYearStructure,
  ReefCompositionDiagnostics,
  ReefCompositionManifest,
  ReefCompositionMetrics,
  ReefCompositionScore,
  ReefStructureCompositionDecision,
} from './composition';
export {
  buildReefSurfaceSystem,
  REEF_SURFACE_CORE_SAMPLES,
  REEF_SURFACE_MAX_PATCHES,
  REEF_SURFACE_MIN_NORMAL_Y,
  REEF_SURFACE_MIN_SUITABILITY,
  REEF_SURFACE_PLATFORM_SAMPLES,
  REEF_SURFACE_VERSION,
  REEF_SURFACE_YEAR_SAMPLES,
} from './surfaceSystem';
export type {
  BuildReefSurfaceSystemInput,
  ReefSurfaceClass,
  ReefSurfaceDiagnostics,
  ReefSurfaceManifest,
  ReefSurfacePatch,
  ReefSurfacePoint,
  ReefSurfaceSourceKind,
} from './surfaceSystem';
export {
  buildReefCoralColonies,
  REEF_CORAL_COLONIES_VERSION,
  REEF_CORAL_MAX_COUNT,
  REEF_CORAL_PLATFORM_BASELINE,
  REEF_CORAL_YEAR_NUCLEATION_CHANCE,
} from './coralColonies';
export type {
  BuildReefCoralColoniesInput,
  ReefCoralColoniesDiagnostics,
  ReefCoralColoniesManifest,
  ReefCoralColony,
  ReefCoralMorphotype,
} from './coralColonies';
export {
  buildReefAccretion,
  REEF_ACCRETION_MAX_LAYERS,
  REEF_ACCRETION_MINERAL_LIMIT,
  REEF_ACCRETION_PLATE_STACK_LIMIT,
  REEF_ACCRETION_SHEET_LIMIT,
  REEF_ACCRETION_SKELETON_LIMIT,
  REEF_ACCRETION_STRUCTURE_SKIRT_LIMIT,
  REEF_ACCRETION_VERSION,
} from './accretion';
export type {
  BuildReefAccretionInput,
  ReefAccretionDiagnostics,
  ReefAccretionKind,
  ReefAccretionLayer,
  ReefAccretionManifest,
} from './accretion';
export type {
  ReefGrowthArchPlacement,
  ReefGrowthOutcropPlacement,
  ReefGrowthStructureLayout,
  ReefGrowthStructureLayoutDiagnostics,
  ReefGrowthStructurePoint,
  ReefGrowthTerracePlacement,
} from './structureGrowth';
export type {
  BuildReefModuleEvolutionInput,
  ReefModuleEvolutionScheduleDay,
} from './moduleEvolution';
export * from './layout';
export * from './foundation';
export * from './skeletons';
export * from './meshes';
export * from './materials';
export * from './life';
export {
  REEF_COLONY_MORPHOTYPES,
  REEF_EVENT_SOURCE_MODULES,
  REEF_INFLUENCE_SOURCES,
  REEF_LIFE_STAGES,
  type BuildReefSpeciesBlueprintInput,
  type ReefColonyMorphotype,
  type ReefColonyRole,
  type ReefColonyTier,
  type ReefEventSourceModule,
  type ReefGrowthGrammar,
  type ReefGrowthInstruction,
  type ReefInfluenceSource,
  type ReefLifeStage,
  type ReefModuleEvolutionColonies,
  type ReefModuleEvolutionEntities,
  type ReefModuleEvolutionEntity,
  type ReefModuleEvolutionEntityKind,
  type ReefModuleEvolutionFacts,
  type ReefModuleEvolutionFoundation,
  type ReefModuleEvolutionLife,
  type ReefModuleEvolutionPlan,
  type ReefModulePopulation,
  type ReefSpeciesBlueprint,
  type ReefSpeciesConfig,
  type ReefSpeciesDiagnostics,
  type ReefSpeciesPressures,
  type ReefSpeciesState,
  type ReefStructureInstruction,
} from './types';
