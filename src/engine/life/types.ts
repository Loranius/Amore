import type { CrystalCompositionState } from '../composition';
import type { CrystalMaterialQuality, CrystalMaterialState } from '../material';
import type { CrystalSpeciesBlueprint } from '../species/crystal';

export interface CrystalLifeConfig {
  /** Bump whenever motion, pulse or sparkle formulas change. */
  rulesVersion: string;
  reducedMotion: boolean;
  quality: CrystalMaterialQuality;
  maxSparkles: number;
  /**
   * Films, series and books the couple has finished (ADR-0004).
   *
   * It arrives here rather than through the Evolution adapters on purpose:
   * `media_items` records no completion date, only a status, so a media event
   * could not be honestly placed on the couple's timeline. Ambience is the one
   * thing that needs no date — it is a count, not a moment — so media drives
   * the dust around the artifact and nothing else. If the table ever gains a
   * finished-at timestamp, media can graduate to a real adapter.
   */
  mediaFinishedCount: number;
}

export interface CrystalBodyLife {
  bodyId: string;
  phaseRad: number;
  speed: number;
  glowAmplitude: number;
  sparkleAffinity: number;
}

export interface CrystalLifeState {
  lifeStateVersion: 1;
  rulesVersion: string;
  sourceSpeciesBlueprintVersion: CrystalSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionStateVersion: CrystalCompositionState['compositionStateVersion'];
  sourceMaterialStateVersion: CrystalMaterialState['materialStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  reducedMotion: boolean;
  quality: CrystalMaterialQuality;
  /**
   * Radians per second the artifact turns about its own vertical axis.
   *
   * Survives while levitation and tilt do not, and the difference is not
   * taste. The platform is flat inside the vein's footprint and bows only
   * outside it, so that flat region is a full annulus — rotationally symmetric.
   * A turn about Y therefore moves the seam through stone of exactly the same
   * height it left, and nothing can rise over it. Tilt broke that symmetry, and
   * a turn then carried the low side around once per revolution.
   */
  rotationSpeed: number;
  breatheAmplitude: number;
  breatheSpeed: number;
  sparkleCount: number;
  sparkleSpeed: number;
  interactionPulseDuration: number;
  bodies: CrystalBodyLife[];
}

/**
 * One sampled instant of the artifact's motion.
 *
 * Every term here is either a turn about the vertical axis or a uniform scale,
 * and that is a hard rule rather than a coincidence: **the artifact is rooted.**
 * Since ADR-0003 it is a druse standing on the ground, and since ADR-0007 it
 * grows out of a fissure in that ground — so nothing in it may translate or tip
 * relative to the stone it came out of. The renderer anchors the scale at the
 * base for the same reason (`ThreeCrystalRenderBundle.baseY`).
 */
export interface CrystalLifeFrame {
  rotationY: number;
  groupScale: number;
  sparklePhase: number;
  bodyGlowMultiplier: Readonly<Record<string, number>>;
}

export interface SampleCrystalLifeInput {
  life: CrystalLifeState;
  elapsedSeconds: number;
  /** 0..1 externally managed interaction pulse progress. */
  interactionPulse?: number;
}

export interface BuildCrystalLifeInput {
  species: CrystalSpeciesBlueprint;
  composition: CrystalCompositionState;
  material: CrystalMaterialState;
  config: CrystalLifeConfig;
}
