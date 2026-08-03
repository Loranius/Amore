export { DEFAULT_GROWTH_ENGINE_CONFIG } from './config';
export { buildGrowthState } from './engine';
export { GROUND_LEAN_SCALE } from './surface';
export {
  buildGrowthSurfaceAtlas,
  buildGrowthSurfaceAtlasFromMass,
} from './surfaceAtlas';
export type {
  BuildGrowthSurfaceAtlasFromMassInput,
  GrowthSurfaceAtlas,
  GrowthSurfaceRegion,
} from './surfaceAtlas';
export type {
  BuildGrowthStateInput,
  GrowthAttachment,
  GrowthAttributeValue,
  GrowthAttributes,
  GrowthBody,
  GrowthCenterRole,
  GrowthCenterState,
  GrowthColonyState,
  GrowthDiagnostics,
  GrowthEngineConfig,
  GrowthHostPreference,
  GrowthState,
  GrowthSurfaceMap,
  GrowthSurfaceOccupancy,
  GrowthTier,
  GrowthVec3,
  UniversalGrowthBlueprint,
  UniversalGrowthCenter,
  UniversalGrowthColony,
  UniversalGrowthInstruction,
} from './types';
