import { CRYSTAL_SUBSTRATE_BODY_ID } from '../geometry/substrate';
import { mediaSparkleCount } from '../species/crystal/growthModel';
import { stableHash32 } from '../evolution';
import type { CrystalMaterialQuality } from '../material';
import type {
  BuildCrystalLifeInput,
  CrystalBodyLife,
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

function qualitySparkleCap(quality: CrystalMaterialQuality): number {
  if (quality === 'high') return 64;
  if (quality === 'balanced') return 42;
  if (quality === 'low') return 18;
  return 0;
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

/** Pure deterministic Life Engine. It never changes topology or growth transforms. */
export function buildCrystalLifeState(input: BuildCrystalLifeInput): CrystalLifeState {
  validateInput(input);
  const motion = input.config.reducedMotion ? 0 : qualityMotionScale(input.config.quality);
  const sparkleCap = Math.min(input.config.maxSparkles, qualitySparkleCap(input.config.quality));
  // Crystal dust now counts what the couple watched and read (ADR-0004)
  // instead of how many bodies the druse happens to have — the body count
  // stopped being a measure of anything once it followed the calendar.
  const sparkleCount = input.config.reducedMotion
    ? 0
    : mediaSparkleCount(input.config.mediaFinishedCount, sparkleCap);

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
    rotationSpeed: round6(0.075 * motion),
    breatheAmplitude: round6(0.0065 * motion),
    breatheSpeed: round6(0.32 * motion),
    sparkleCount,
    sparkleSpeed: round6(0.18 * motion),
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
    rotationY: round6(moving ? elapsed * life.rotationSpeed : 0),
    groupScale: round6(1 + (moving
      ? Math.sin(elapsed * life.breatheSpeed) * life.breatheAmplitude + pulse * 0.006
      : 0)),
    sparklePhase: round6(moving ? (elapsed * life.sparkleSpeed) % 1 : 0),
    bodyGlowMultiplier,
  };
}
