export interface GrowthVec3 {
  x: number;
  y: number;
  z: number;
}

export type GrowthTier = 'king' | 'support' | 'family' | 'companion' | 'micro';
export type GrowthHostPreference = 'root' | 'same-colony' | 'balanced' | 'surface';

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
  hostBodyId: string;
  hostT: number;
  hostAngleRad: number;
  point: GrowthVec3;
  normal: GrowthVec3;
  burialDepth: number;
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
}

export interface GrowthSurfaceOccupancy {
  siteKey: string;
  bodyId: string;
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
  diagnostics: GrowthDiagnostics;
}

export interface BuildGrowthStateInput {
  blueprint: UniversalGrowthBlueprint;
  config: GrowthEngineConfig;
}
