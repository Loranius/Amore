import type {
  ArtifactBlueprint,
  EvolutionChannel,
  EvolutionPressureVector,
} from '../../evolution';

export const CRYSTAL_LIFE_STAGES = [
  'nucleation',
  'growth',
  'competition',
  'polishing',
  'stabilization',
] as const;

export type CrystalLifeStage = (typeof CRYSTAL_LIFE_STAGES)[number];

/**
 * What a crystal body stands for.
 *
 * Since ADR-0004 there are exactly three. A body used to stand for a single
 * portal row, which made the count grow without a ceiling; now it stands for
 * the couple as a whole, for one of their years, or for one thing they
 * finished together.
 */
export type CrystalFormationKind =
  | 'mother'
  /** One relationship year, frozen at its anniversary. */
  | 'annual'
  /** A completed plan, in the ring of small crystals around the monarch. */
  | 'skirt';

export type CrystalFormationTier =
  | 'king'
  | 'support'
  | 'family'
  | 'companion'
  | 'micro';

export type CrystalArchetype =
  | 'prismatic'
  | 'massive'
  | 'needle'
  | 'twin'
  | 'blade'
  | 'tabular'
  | 'fan'
  | 'split'
  | 'intergrown'
  | 'etched';

export type LegacyCrystalDomain =
  | 'exploration'
  | 'memory'
  | 'connection'
  | 'creation'
  | 'future';

export interface CrystalSpeciesConfig {
  /** Explicit clock. Species code never reads Date.now(). */
  asOf: string;
  /** Bump whenever species formulas or archetype rules change. */
  rulesVersion: string;
  /**
   * Which partner each colour channel belongs to (ADR-0004).
   *
   * Deliberately two opaque ids rather than anything about the people: the
   * engine has no concept of gender and should not grow one. Which partner is
   * which is an application-layer decision, so it can move to a profile field
   * later without the engine noticing.
   *
   * Wishes belonging to `first` that `second` granted colour the red channel,
   * the mirror image colours blue, and shared wishes colour green. Omit both
   * and every annual crystal stays white.
   */
  colorPartners?: { first: number | null; second: number | null };
}

export interface CrystalSpeciesPressures {
  expansion: number;
  refinement: number;
  luminosity: number;
  warmth: number;
  stability: number;
  harmony: number;
  brilliance: number;
  surfaceComplexity: number;
  density: number;
  branching: number;
  mutation: number;
  dominantChannel: EvolutionChannel | null;
  dominance: number;
  channelShare: EvolutionPressureVector;
}

export interface CrystalSpeciesState {
  ageDays: number;
  epochCount: number;
  eventCount: number;
  stage: CrystalLifeStage;
  stress: number;
  purity: number;
  cohesion: number;
  energy: number;
  fracture: number;
  density: number;
  luminosity: number;
}

/**
 * A stable species instruction. It describes what should grow and its seeded
 * directional preference, but not an anchor, mesh or Three.js transform.
 * Spatial attachment belongs to the universal Growth Engine.
 */
export interface CrystalGrowthInstruction {
  id: string;
  sourceEventId: string | null;
  sourceEpisodeId: string | null;
  epochIndex: number;
  channel: EvolutionChannel | null;
  kind: CrystalFormationKind;
  tier: CrystalFormationTier;
  archetype: CrystalArchetype;
  emphasized: boolean;
  weight: number;
  maturity: number;
  /**
   * Final height and radius of the body, in engine units.
   *
   * These used to be derived inside the growth adapter from `weight` and
   * `kind`. Since ADR-0004 the size of every body follows a different rule
   * per kind — days together for the monarch, the year's own history for an
   * annual crystal — so the decision belongs to the species that knows those
   * rules, and the adapter is left doing only translation.
   */
  axialScale: number;
  radialScale: number;
  /**
   * Sides the lathe revolves. Data, not detail: since ADR-0004 the monarch's
   * facet count is earned with photos, so it must not vary with the device's
   * level of detail.
   */
  facetCount: number;
  azimuthRad: number;
  elevation: number;
  radialBias: number;
  attachmentDepth: number;
  /**
   * Distance from the monarch's axis, in engine units.
   *
   * Explicit since ADR-0004. The growth engine used to derive it from the
   * monarch's own radius, which coupled two unrelated things: thickening the
   * monarch shifted every crystal standing around her, so a new photo nudged
   * the whole druse. Null keeps the engine's own placement for species that
   * have no opinion.
   */
  ringDistance: number | null;
  /**
   * Linear RGB the body is tinted, and how strongly its facets refract.
   * White with no iridescence is the state every crystal is born in.
   */
  tintRgb: readonly [number, number, number];
  iridescence: number;
  /**
   * How far the ground spreads beyond the druse's own footprint, as a
   * multiplier of 1 or more. Published on the monarch only; the geometry
   * volume reads a number and never learns what a "place" is.
   */
  groundSpread: number;
  seed: number;
}

/** A stable sector that groups formations without mutating their identities. */
export interface CrystalColonyBlueprint {
  id: string;
  epochIndex: number;
  channel: EvolutionChannel;
  seed: number;
  azimuthRad: number;
  elevation: number;
  weight: number;
  instructionIds: string[];
}

export interface CrystalSpeciesDiagnostics {
  emptyHistory: boolean;
  zeroPressureEventIds: string[];
  futureEventIds: string[];
}

export interface CrystalSpeciesBlueprint {
  speciesBlueprintVersion: 1;
  species: 'crystal';
  rulesVersion: string;
  sourceBlueprintVersion: ArtifactBlueprint['blueprintVersion'];
  engineVersion: string;
  coupleId: string;
  artifactSeed: number;
  asOf: string;
  pressures: CrystalSpeciesPressures;
  state: CrystalSpeciesState;
  mother: CrystalGrowthInstruction;
  formations: CrystalGrowthInstruction[];
  colonies: CrystalColonyBlueprint[];
  diagnostics: CrystalSpeciesDiagnostics;
}

export interface BuildCrystalSpeciesBlueprintInput {
  artifact: ArtifactBlueprint;
  config: CrystalSpeciesConfig;
}

/** Structural shape consumed by the current crystal renderer compatibility bridge. */
export interface LegacyCrystalPressureProjection {
  expansion: number;
  refinement: number;
  luminosity: number;
  warmth: number;
  stability: number;
  harmony: number;
  movieMix: number;
  brilliance: number;
  surfaceComplexity: number;
  density: number;
  dominant: LegacyCrystalDomain | null;
  dominance: number;
  domainShare: Record<LegacyCrystalDomain, number>;
}
