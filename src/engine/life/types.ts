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

/**
 * One point of light caught inside the monarch.
 *
 * Position is in **the monarch's own normalised frame** — x and z in -1..1
 * across her widest slice, y from 0 at the foot to 1 at the tip, the same frame
 * the geometry publishes as `CrystalMeshData.bodyCoord`. Published that way so
 * this volume needs no geometry of its own: the renderer already holds the
 * monarch's bounds and maps a unit frame into them, and Life reading Geometry
 * would be a new dependency bought for a number the renderer already has.
 *
 * Every field is seeded from the artifact seed, so a couple's crystal has the
 * same inclusions every time it is drawn. The cloud this replaces was drei's
 * `<Sparkles>`, which draws its sizes from `Math.random()` — two mounts of one
 * couple's artifact produced two different artifacts, which the determinism
 * standard forbids outright.
 */
export interface CrystalInnerSpark {
  x: number;
  y: number;
  z: number;
  /** Where in its own twinkle this spark starts, so they never blink together. */
  phaseRad: number;
  /** Radians per second of that twinkle. Zero under reduced motion. */
  speed: number;
  /** Point size in pixels before attenuation. */
  size: number;
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
  /**
   * The lights inside the monarch, and nowhere else in the colony.
   *
   * This replaces `sparkleCount`, which fed a cloud of dust floating *around*
   * the whole artifact at three times its size. Two reasons it went: the cloud
   * was drei's `<Sparkles>`, whose sizes come from `Math.random()`, and dust in
   * the air says nothing about the couple — the crystal is the artifact, and
   * what belongs inside it is what the couple has finished and kept.
   *
   * Empty on the two weakest tiers, which is a decision rather than a budget:
   * a handful of additive points over a small crystal on a weak phone reads as
   * noise on the screen rather than as light in a stone.
   */
  innerSparks: readonly CrystalInnerSpark[];
  sparkleSpeed: number;
  /**
   * How fast the energy inside the monarch turns, in whole turns per second.
   *
   * Its own clock rather than the sparkle's, and by an order of magnitude: dust
   * catching the light is a twinkle, and the flow in the body's core is a slow
   * convection. Sharing `sparkleSpeed` would have spun the helix ten times too
   * fast, at which point it stops reading as something moving inside stone and
   * starts reading as an animation playing on it.
   *
   * Zero under reduced motion, through the same `motion` gate as every other
   * term here — so the helix is still drawn, and still exactly where the
   * couple's seed puts it, but it holds still.
   */
  innerFlowSpeed: number;
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
  /** Turns completed by the monarch's inner flow, wrapped to 0..1. */
  innerFlowPhase: number;
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
