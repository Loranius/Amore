import { CRYSTAL_SUBSTRATE_BODY_ID } from '../geometry/substrate';
import { mediaSparkReach } from '../species/crystal/growthModel';
import { stableHash32 } from '../evolution';
import type { CrystalMaterialQuality } from '../material';
import type {
  BuildCrystalLifeInput,
  CrystalBodyLife,
  CrystalInnerSpark,
  CrystalLifeFrame,
  CrystalLifeState,
  SampleCrystalLifeInput,
} from './types';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function seededUnit(seed: number, salt: string): number {
  return stableHash32(`${seed}\u001f${salt}`) / 0xffffffff;
}

function qualityMotionScale(quality: CrystalMaterialQuality): number {
  if (quality === 'high') return 1;
  if (quality === 'balanced') return 0.82;
  if (quality === 'low') return 0.52;
  return 0;
}

/**
 * How many lights may hang inside the monarch, by quality tier.
 *
 * The crystal brief's §9 bands. Nothing on the two weakest tiers, and that is
 * a decision rather than a saving: a scatter of additive points over a crystal
 * drawn small on a weak phone reads as noise on the screen, not as light caught
 * in a stone. Better absent than misread.
 */
function innerSparkBand(quality: CrystalMaterialQuality): { min: number; max: number } {
  if (quality === 'high') return { min: 24, max: 48 };
  if (quality === 'balanced') return { min: 8, max: 16 };
  return { min: 0, max: 0 };
}

/**
 * The monarch's silhouette, as the largest radius a spark may sit at.
 *
 * A spark is an inclusion, so it has to be *inside* the stone: the cloud is
 * drawn additively over the shell (an opaque body cannot be seen through), and
 * a point that strays outside the silhouette stops reading as something caught
 * in the crystal and starts reading as dust in front of it.
 *
 * The body narrows both ways from its widest slice — the gem pass put that at
 * 58–72% of the height with a root 62–75% of the maximum — so a constant radius
 * would put every high spark outside the crown. This is the inscribed cone
 * pair: rising from the root share to 1 at the widest slice, then falling to
 * nothing at the tip.
 */
const SPARK_ROOT_SHARE = 0.62;
const SPARK_WIDEST_AT = 0.65;
/** Margin inside that silhouette, so a spark never lands on a facet. */
const SPARK_INSET = 0.66;
/** The band sparks occupy, matching the inner flow's envelope. */
const SPARK_LOW = 0.1;
const SPARK_HIGH = 0.88;

function sparkEnvelope(height: number): number {
  const rising = SPARK_ROOT_SHARE
    + (1 - SPARK_ROOT_SHARE) * Math.min(1, height / SPARK_WIDEST_AT);
  const falling = (1 - height) / Math.max(1e-6, 1 - SPARK_WIDEST_AT);
  return Math.max(0, Math.min(rising, falling));
}

function validateInput(input: BuildCrystalLifeInput): void {
  if (!input.config.rulesVersion.trim()) throw new Error('Crystal Life requires a non-empty rulesVersion.');
  if (!Number.isInteger(input.config.maxSparkles) || input.config.maxSparkles < 0) {
    throw new Error('Crystal Life maxSparkles must be a non-negative integer.');
  }
  if (input.species.artifactSeed !== input.composition.artifactSeed) {
    throw new Error('Crystal Life received composition from another artifact.');
  }
  if (input.species.artifactSeed !== input.material.artifactSeed) {
    throw new Error('Crystal Life received material state from another artifact.');
  }
}

function bodyLife(input: BuildCrystalLifeInput, bodyId: string): CrystalBodyLife {
  // The substrate is rock. It carries no inner light, so it must not breathe
  // or sparkle with the crystals — without this it would fall through to the
  // default role and pulse like one.
  if (bodyId === CRYSTAL_SUBSTRATE_BODY_ID) {
    return {
      bodyId,
      phaseRad: 0,
      speed: 0,
      glowAmplitude: 0,
      sparkleAffinity: 0,
    };
  }

  const composition = input.composition.bodies.find((body) => body.sourceBodyId === bodyId);
  const role = composition?.role ?? 'family';
  const roleGlow = role === 'focal' ? 1 : role === 'support' ? 0.78 : role === 'micro' ? 0.28 : 0.52;
  return {
    bodyId,
    phaseRad: round6(seededUnit(input.species.artifactSeed, `life:${bodyId}:phase`) * Math.PI * 2),
    speed: round6(0.28 + seededUnit(input.species.artifactSeed, `life:${bodyId}:speed`) * 0.24),
    glowAmplitude: round6((0.012 + input.species.pressures.luminosity * 0.055) * roleGlow),
    sparkleAffinity: round6(clamp01(
      seededUnit(input.species.artifactSeed, `life:${bodyId}:sparkle`) * 0.45
        + input.species.pressures.brilliance * 0.35
        + (role === 'focal' ? 0.2 : 0),
    )),
  };
}

/**
 * The lights inside the monarch: how many, and where each one sits.
 *
 * Seeded throughout, so a couple's crystal carries the same inclusions every
 * time it is drawn. Under reduced motion the sparks stay exactly where they are
 * and stop twinkling — the same treatment the inner flow gets, and for the same
 * reason: stillness was asked for, not emptiness.
 */
function innerSparks(input: BuildCrystalLifeInput): CrystalInnerSpark[] {
  const band = innerSparkBand(input.config.quality);
  if (band.max === 0) return [];
  // The media curve decides where in the band a couple lands, so ADR-0004's
  // "the dust counts what they watched and read" survives the move inside the
  // crystal instead of being quietly dropped with the cloud that carried it.
  // The band's floor still holds: a couple who has finished nothing gets a
  // monarch with lights in her, just fewer of them.
  //
  // Mapped *across* the band rather than clamped against its floor. Clamping
  // was the first version and it clipped the signal away at the bottom — a
  // couple with twenty-five finished titles and a couple with none both landed
  // on twenty-four, so a whole shelf of books moved nothing. The same failure,
  // in the same shape, as clamping a quiet year's fill into a height band.
  const reach = mediaSparkReach(input.config.mediaFinishedCount);
  const count = Math.min(
    input.config.maxSparkles,
    band.min + Math.round((band.max - band.min) * reach),
  );
  const seed = input.species.artifactSeed;
  const moving = !input.config.reducedMotion;

  const sparks: CrystalInnerSpark[] = [];
  for (let index = 0; index < count; index += 1) {
    const height = SPARK_LOW
      + seededUnit(seed, `spark:${index}:y`) * (SPARK_HIGH - SPARK_LOW);
    // Square root of the draw, so the points spread evenly over the *area* of
    // each slice. Taking the draw raw crowds them onto the axis, which reads as
    // a lit rod down the middle of the crystal rather than as scattered
    // inclusions.
    const radius = Math.sqrt(seededUnit(seed, `spark:${index}:r`))
      * SPARK_INSET
      * sparkEnvelope(height);
    const angle = seededUnit(seed, `spark:${index}:angle`) * Math.PI * 2;
    sparks.push({
      x: round6(Math.cos(angle) * radius),
      y: round6(height),
      z: round6(Math.sin(angle) * radius),
      phaseRad: round6(seededUnit(seed, `spark:${index}:phase`) * Math.PI * 2),
      speed: round6(moving
        ? 0.6 + seededUnit(seed, `spark:${index}:speed`) * 1.4
        : 0),
      size: round6(1.1 + seededUnit(seed, `spark:${index}:size`) * 1.5),
    });
  }
  return sparks;
}

/** Pure deterministic Life Engine. It never changes topology or growth transforms. */
export function buildCrystalLifeState(input: BuildCrystalLifeInput): CrystalLifeState {
  validateInput(input);
  const motion = input.config.reducedMotion ? 0 : qualityMotionScale(input.config.quality);

  return {
    lifeStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceCompositionStateVersion: input.composition.compositionStateVersion,
    sourceMaterialStateVersion: input.material.materialStateVersion,
    engineVersion: input.species.engineVersion,
    speciesRulesVersion: input.species.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    reducedMotion: input.config.reducedMotion,
    quality: input.config.quality,
    breatheAmplitude: round6(0.0065 * motion),
    breatheSpeed: round6(0.32 * motion),
    innerSparks: innerSparks(input),
    sparkleSpeed: round6(0.18 * motion),
    // Mid-band of the 0.018–0.025 turns/sec the crystal brief allows the inner
    // flow. A tenth of the sparkle's rate, which is the point: one turn takes
    // about fifty seconds, so a couple looking at the portal sees the light
    // move without ever catching it in the act.
    innerFlowSpeed: round6(0.021 * motion),
    interactionPulseDuration: input.config.reducedMotion ? 0.28 : 0.46,
    bodies: input.material.bodies.map((body) => bodyLife(input, body.bodyId)),
  };
}

export function sampleCrystalLife(input: SampleCrystalLifeInput): CrystalLifeFrame {
  const elapsed = Number.isFinite(input.elapsedSeconds) ? Math.max(0, input.elapsedSeconds) : 0;
  const pulse = clamp01(input.interactionPulse ?? 0);
  const life = input.life;
  const moving = !life.reducedMotion;
  const bodyGlowMultiplier: Record<string, number> = {};

  for (const body of life.bodies) {
    const wave = moving ? Math.sin(elapsed * body.speed + body.phaseRad) * body.glowAmplitude : 0;
    bodyGlowMultiplier[body.bodyId] = round6(1 + wave + pulse * (0.04 + body.sparkleAffinity * 0.08));
  }

  return {
    groupScale: round6(1 + (moving
      ? Math.sin(elapsed * life.breatheSpeed) * life.breatheAmplitude + pulse * 0.006
      : 0)),
    sparklePhase: round6(moving ? (elapsed * life.sparkleSpeed) % 1 : 0),
    innerFlowPhase: round6(moving ? (elapsed * life.innerFlowSpeed) % 1 : 0),
    bodyGlowMultiplier,
  };
}
