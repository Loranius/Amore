export interface GrowthVec3 {
  x: number;
  y: number;
  z: number;
}

export type GrowthTier = 'king' | 'support' | 'family' | 'companion' | 'micro';
export type GrowthHostPreference = 'root' | 'same-colony' | 'balanced' | 'surface';
export type GrowthCenterRole = 'dominant' | 'satellite' | 'micro';

export type GrowthAttributeValue = string | number | boolean | null;
export type GrowthAttributes = Readonly<Record<string, GrowthAttributeValue>>;

/**
 * Species-neutral instruction consumed by the Universal Growth Engine.
 *
 * Crystal, Tree and Coral adapters decide these values. The engine only places,
 * attaches and competes bodies; it never interprets an archetype or module.
 */
export interface UniversalGrowthInstruction {
  id: string;
  sourceId: string | null;
  sequence: number;
  colonyId: string | null;
  epochIndex: number;
  kind: string;
  tier: GrowthTier;
  seed: number;
  emphasized: boolean;
  weight: number;
  maturity: number;
  axialScale: number;
  radialScale: number;
  /**
   * Conservative fraction of analytical radius safe for future attachments.
   * Faceted or concave species use < 1 so Growth Sites cannot land outside the
   * eventual mesh even when the analytical envelope is circular.
   */
  surfaceRadiusScale: number;
  preferredAzimuthRad: number;
  preferredElevation: number;
  radialBias: number;
  attachmentDepth: number;
  hostPreference: GrowthHostPreference;
  maxGeneration: number;
  directionInheritance: number;
  minUpwardComponent: number;
  attributes: GrowthAttributes;
  /** Stable local geological center. Optional for non-crystal species and v1 snapshots. */
  growthCenterId?: string | null;
  /** Member role inside a local geological center. */
  growthCenterRole?: GrowthCenterRole | null;
}

export interface UniversalGrowthColony {
  id: string;
  seed: number;
  epochIndex: number;
  kind: string;
  preferredAzimuthRad: number;
  preferredElevation: number;
  weight: number;
  instructionIds: string[];
}

export interface UniversalGrowthCenter {
  id: string;
  sourceInstructionId: string;
  sourceId: string | null;
  seed: number;
  epochIndex: number;
  kind: string;
  preferredAzimuthRad: number;
  preferredElevation: number;
  weight: number;
  instructionIds: string[];
}

export interface UniversalGrowthBlueprint {
  growthBlueprintVersion: 1;
  species: string;
  sourceBlueprintVersion: string;
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  root: UniversalGrowthInstruction;
  instructions: UniversalGrowthInstruction[];
  colonies: UniversalGrowthColony[];
  /** Optional for non-crystal adapters and backward-compatible imported blueprints. */
  growthCenters?: UniversalGrowthCenter[];
}

export interface GrowthEngineConfig {
  /** Bump when placement, attachment or competition formulas change. */
  rulesVersion: string;
  /** Fixed draw count per body. It must not depend on scene density. */
  candidateCount: number;
  minAngularSeparationRad: number;
  collisionPadding: number;
  maxBodies: number;
}

export interface GrowthAttachment {
  siteKey: string;
  /** Stable aggregate Surface Atlas region chosen for this attachment. */
  surfaceRegionId?: string;
  /** Compatibility/provenance body used by Geometry and Fusion. */
  hostBodyId: string;
  hostT: number;
  hostAngleRad: number;
  point: GrowthVec3;
  normal: GrowthVec3;
  burialDepth: number;
  /** Growth Shadow measured when this body nucleated. */
  growthShadow?: number;
  /** Same-center competition measured when this body nucleated. */
  competitionPressure?: number;
}

export interface GrowthBody {
  id: string;
  instructionId: string;
  sourceId: string | null;
  species: string;
  kind: string;
  tier: GrowthTier;
  attributes: GrowthAttributes;
  sequence: number;
  colonyId: string | null;
  epochIndex: number;
  seed: number;
  emphasized: boolean;
  generation: number;
  hostBodyId: string | null;
  attachment: GrowthAttachment | null;
  anchor: GrowthVec3;
  direction: GrowthVec3;
  skeletonLength: number;
  skeletonRadius: number;
  surfaceRadiusScale: number;
  renderedLength: number;
  renderedRadius: number;
  maturity: number;
  growthEnergy: number;
  competition: number;
  crowding: number;
  /** Optional for backward-compatible reads of Growth State v1 snapshots. */
  growthCenterId?: string | null;
  /** Optional for backward-compatible reads of Growth State v1 snapshots. */
  growthCenterRole?: GrowthCenterRole | null;
}

export interface GrowthSurfaceOccupancy {
  siteKey: string;
  bodyId: string;
  /** Optional for backward-compatible reads of Growth State v1 snapshots. */
  surfaceRegionId?: string;
  hostBodyId: string;
  hostT: number;
  hostAngleRad: number;
}

export interface GrowthSurfaceMap {
  surfaceMapVersion: 1;
  occupiedSites: GrowthSurfaceOccupancy[];
}

export interface GrowthColonyState {
  id: string;
  kind: string;
  epochIndex: number;
  seed: number;
  bodyIds: string[];
  rootBodyId: string | null;
  totalWeight: number;
  maxGeneration: number;
}

export interface GrowthCenterState {
  id: string;
  sourceInstructionId: string;
  sourceId: string | null;
  kind: string;
  epochIndex: number;
  seed: number;
  bodyIds: string[];
  dominantBodyId: string | null;
  surfaceRegionId: string | null;
  totalWeight: number;
  maxGeneration: number;
}

export interface GrowthDiagnostics {
  truncatedInstructionIds: string[];
  fallbackInstructionIds: string[];
  generationClampedInstructionIds: string[];
  crowdedInstructionIds: string[];
  rejectedCandidateCount: number;
  maxCompetition: number;
}

export interface GrowthState {
  growthStateVersion: 1;
  rulesVersion: string;
  sourceBlueprintVersion: UniversalGrowthBlueprint['sourceBlueprintVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  species: string;
  artifactSeed: number;
  bodies: GrowthBody[];
  surfaceMap: GrowthSurfaceMap;
  colonies: GrowthColonyState[];
  /** Optional for backward-compatible reads of Growth State v1 snapshots. */
  growthCenters?: GrowthCenterState[];
  diagnostics: GrowthDiagnostics;
}

export interface BuildGrowthStateInput {
  blueprint: UniversalGrowthBlueprint;
  config: GrowthEngineConfig;
}
