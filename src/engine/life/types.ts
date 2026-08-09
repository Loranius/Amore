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
 * Every term here is a uniform scale, and that is a hard rule rather than a
 * coincidence: **the artifact is rooted.** Since ADR-0003 it is a druse
 * standing on the ground, and since ADR-0007 it grows out of a fissure in that
 * ground — so nothing in it may translate or tip relative to the stone it came
 * out of. The renderer anchors the scale at the base for the same reason
 * (`ThreeCrystalRenderBundle.baseY`).
 *
 * **Nor may it turn.** The artifact used to spin about its own axis at a
 * seeded rate, which is the one motion a rooted body cannot have: a crystal in
 * stone does not revolve, and the spin fought the viewer — the couple would
 * drag it to a face they liked and it would carry that face away again. The
 * only rotation left in the portal is the camera's, under the viewer's own
 * finger (`OrbitControls` in `PortalStage`), so the artifact holds still and
 * the couple walks around it.
 */
export interface CrystalLifeFrame {
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
