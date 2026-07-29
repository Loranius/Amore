import type { CrystalCompositionState } from '../composition';
import type { CrystalMaterialQuality, CrystalMaterialState } from '../material';
import type { CrystalSpeciesBlueprint } from '../species/crystal';

export interface CrystalLifeConfig {
  /** Bump whenever motion, pulse or sparkle formulas change. */
  rulesVersion: string;
  reducedMotion: boolean;
  quality: CrystalMaterialQuality;
  maxSparkles: number;
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
