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
  rotationSpeed: number;
  tiltXAmplitude: number;
  tiltZAmplitude: number;
  levitationAmplitude: number;
  levitationSpeed: number;
  breatheAmplitude: number;
  breatheSpeed: number;
  sparkleCount: number;
  sparkleSpeed: number;
  interactionPulseDuration: number;
  bodies: CrystalBodyLife[];
}

export interface CrystalLifeFrame {
  rotationY: number;
  tiltX: number;
  tiltZ: number;
  positionY: number;
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
