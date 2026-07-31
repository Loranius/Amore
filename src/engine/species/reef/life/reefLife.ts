import { DEFAULT_REEF_LIFE_CONFIG } from './config';
import { clamp01, round6, seededUnit } from '../math';
import type { ReefColonyMorphotype } from '../types';
import type { ReefColonyPlacement, ReefLayoutVec3 } from '../layout';
import type {
  BuildReefLifeInput,
  ReefColonyMotionBinding,
  ReefCurrentField,
  ReefLifeConfig,
  ReefLifeState,
  ReefMotionClass,
} from './types';

const TAU = Math.PI * 2;

interface MotionSpec {
  motionClass: ReefMotionClass;
  currentInfluence: number;
  swayAmplitudeRadians: number;
  swayFrequencyHz: number;
  bendExponent: number;
  polypCoverage: number;
  polypExtension: number;
  polypPulseAmplitude: number;
  polypPulseFrequencyHz: number;
}

const MOTION_SPECS: Record<ReefColonyMorphotype, MotionSpec> = {
  branching: {
    motionClass: 'semi-rigid',
    currentInfluence: 0.42,
    swayAmplitudeRadians: 0.018,
    swayFrequencyHz: 0.1,
    bendExponent: 1.8,
    polypCoverage: 0.42,
    polypExtension: 0.52,
    polypPulseAmplitude: 0.035,
    polypPulseFrequencyHz: 0.18,
  },
  massive: {
    motionClass: 'rigid',
    currentInfluence: 0.16,
    swayAmplitudeRadians: 0.003,
    swayFrequencyHz: 0.055,
    bendExponent: 2.6,
    polypCoverage: 0.68,
    polypExtension: 0.38,
    polypPulseAmplitude: 0.025,
    polypPulseFrequencyHz: 0.13,
  },
  plating: {
    motionClass: 'semi-rigid',
    currentInfluence: 0.3,
    swayAmplitudeRadians: 0.01,
    swayFrequencyHz: 0.075,
    bendExponent: 2.1,
    polypCoverage: 0.48,
    polypExtension: 0.46,
    polypPulseAmplitude: 0.03,
    polypPulseFrequencyHz: 0.15,
  },
  encrusting: {
    motionClass: 'rigid',
    currentInfluence: 0.08,
    swayAmplitudeRadians: 0.001,
    swayFrequencyHz: 0.045,
    bendExponent: 3,
    polypCoverage: 0.78,
    polypExtension: 0.34,
    polypPulseAmplitude: 0.018,
    polypPulseFrequencyHz: 0.12,
  },
  'soft-coral': {
    motionClass: 'flexible',
    currentInfluence: 0.86,
    swayAmplitudeRadians: 0.105,
    swayFrequencyHz: 0.12,
    bendExponent: 1.35,
    polypCoverage: 0.35,
    polypExtension: 0.72,
    polypPulseAmplitude: 0.085,
    polypPulseFrequencyHz: 0.22,
  },
  'sea-fan': {
    motionClass: 'membrane',
    currentInfluence: 0.94,
    swayAmplitudeRadians: 0.14,
    swayFrequencyHz: 0.095,
    bendExponent: 1.15,
    polypCoverage: 0.26,
    polypExtension: 0.58,
    polypPulseAmplitude: 0.06,
    polypPulseFrequencyHz: 0.16,
  },
};

function vector(x = 0, y = 0, z = 0): ReefLayoutVec3 {
  return { x: round6(x), y: round6(y), z: round6(z) };
}

function length(value: ReefLayoutVec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value: ReefLayoutVec3, fallback = vector(0, 1, 0)): ReefLayoutVec3 {
  const magnitude = length(value);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-10) return { ...fallback };
  return vector(value.x / magnitude, value.y / magnitude, value.z / magnitude);
}

function subtract(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return vector(left.x - right.x, left.y - right.y, left.z - right.z);
}

function scale(value: ReefLayoutVec3, amount: number): ReefLayoutVec3 {
  return vector(value.x * amount, value.y * amount, value.z * amount);
}

function dot(left: ReefLayoutVec3, right: ReefLayoutVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function validateConfig(config: ReefLifeConfig): void {
  if (!config.rulesVersion.trim()) {
    throw new Error('Reef Life requires a non-empty rulesVersion');
  }
  if (!Number.isInteger(config.maximumMotionBindings) || config.maximumMotionBindings <= 0) {
    throw new Error('Reef Life maximumMotionBindings must be a positive integer');
  }
  for (const [name, value] of [
    ['baseCurrentStrength', config.baseCurrentStrength],
    ['currentTurbulence', config.currentTurbulence],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`Reef Life ${name} must be between 0 and 1`);
    }
  }
  if (!Number.isFinite(config.minimumCurrentCycleSeconds)
    || !Number.isFinite(config.maximumCurrentCycleSeconds)
    || config.minimumCurrentCycleSeconds <= 0
    || config.maximumCurrentCycleSeconds < config.minimumCurrentCycleSeconds) {
    throw new Error('Reef Life current cycle bounds are invalid');
  }
  if (!Number.isFinite(config.maximumSwayRadians)
    || config.maximumSwayRadians <= 0
    || config.maximumSwayRadians > Math.PI / 2) {
    throw new Error('Reef Life maximumSwayRadians is invalid');
  }
  if (!Number.isFinite(config.maximumPolypPulseAmplitude)
    || config.maximumPolypPulseAmplitude < 0
    || config.maximumPolypPulseAmplitude > 1) {
    throw new Error('Reef Life maximumPolypPulseAmplitude must be between 0 and 1');
  }
}

function validateProvenance(input: BuildReefLifeInput): void {
  const { species, layout, foundation, skeletons, meshes, materials } = input;
  if (species.species !== 'reef') {
    throw new Error('Reef Life requires a Reef Species blueprint');
  }
  if (
    layout.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || layout.sourceSpeciesRulesVersion !== species.rulesVersion
    || layout.artifactSeed !== species.artifactSeed
    || layout.asOf !== species.asOf
  ) {
    throw new Error('Reef Life received incompatible Colony Layout provenance');
  }
  if (
    foundation.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || foundation.sourceSpeciesRulesVersion !== species.rulesVersion
    || foundation.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || foundation.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || foundation.artifactSeed !== species.artifactSeed
    || foundation.asOf !== species.asOf
  ) {
    throw new Error('Reef Life received incompatible Foundation Mesh provenance');
  }
  if (
    skeletons.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || skeletons.sourceSpeciesRulesVersion !== species.rulesVersion
    || skeletons.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || skeletons.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || skeletons.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || skeletons.sourceFoundationRulesVersion !== foundation.rulesVersion
    || skeletons.artifactSeed !== species.artifactSeed
    || skeletons.asOf !== species.asOf
  ) {
    throw new Error('Reef Life received incompatible Colony Skeleton provenance');
  }
  if (
    meshes.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || meshes.sourceSpeciesRulesVersion !== species.rulesVersion
    || meshes.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || meshes.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || meshes.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || meshes.sourceFoundationRulesVersion !== foundation.rulesVersion
    || meshes.sourceColonySkeletonVersion !== skeletons.reefColonySkeletonVersion
    || meshes.sourceColonySkeletonRulesVersion !== skeletons.rulesVersion
    || meshes.artifactSeed !== species.artifactSeed
    || meshes.asOf !== species.asOf
  ) {
    throw new Error('Reef Life received incompatible Colony Mesh provenance');
  }
  if (
    materials.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || materials.sourceSpeciesRulesVersion !== species.rulesVersion
    || materials.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || materials.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || materials.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || materials.sourceFoundationRulesVersion !== foundation.rulesVersion
    || materials.sourceColonySkeletonVersion !== skeletons.reefColonySkeletonVersion
    || materials.sourceColonySkeletonRulesVersion !== skeletons.rulesVersion
    || materials.sourceColonyMeshVersion !== meshes.reefColonyMeshVersion
    || materials.sourceColonyMeshRulesVersion !== meshes.rulesVersion
    || materials.artifactSeed !== species.artifactSeed
    || materials.asOf !== species.asOf
  ) {
    throw new Error('Reef Life received incompatible Material provenance');
  }
}

function buildCurrent(artifactSeed: number, config: ReefLifeConfig): ReefCurrentField {
  const heading = seededUnit(artifactSeed, 'reef-life-current-heading') * TAU;
  const vertical = (seededUnit(artifactSeed, 'reef-life-current-vertical') * 2 - 1) * 0.08;
  const direction = normalize(vector(Math.cos(heading), vertical, Math.sin(heading)), vector(1, 0, 0));
  const strengthVariation = 0.82 + seededUnit(artifactSeed, 'reef-life-current-strength') * 0.18;
  const cycleRange = config.maximumCurrentCycleSeconds - config.minimumCurrentCycleSeconds;
  return {
    id: 'reef:life:current',
    direction,
    strength: round6(clamp01(config.baseCurrentStrength * strengthVariation)),
    turbulence: round6(config.currentTurbulence),
    cycleSeconds: round6(
      config.minimumCurrentCycleSeconds
      + seededUnit(artifactSeed, 'reef-life-current-cycle') * cycleRange,
    ),
    phaseRadians: round6(seededUnit(artifactSeed, 'reef-life-current-phase') * TAU),
  };
}

function tangentDirection(
  current: ReefLayoutVec3,
  normal: ReefLayoutVec3,
  facingRad: number,
): ReefLayoutVec3 {
  const unitNormal = normalize(normal);
  const projected = subtract(current, scale(unitNormal, dot(current, unitNormal)));
  const fallback = vector(Math.sin(facingRad), 0, Math.cos(facingRad));
  return normalize(projected, normalize(fallback, vector(1, 0, 0)));
}

function buildBinding(
  colony: ReefColonyPlacement,
  sourceRangeId: string,
  sourceMaterialBindingId: string,
  current: ReefCurrentField,
  config: ReefLifeConfig,
): ReefColonyMotionBinding {
  const spec = MOTION_SPECS[colony.morphotype];
  const amplitudeVariation = 0.84 + seededUnit(colony.seed, 'reef-life-sway-amplitude') * 0.32;
  const frequencyVariation = 0.86 + seededUnit(colony.seed, 'reef-life-sway-frequency') * 0.28;
  const exposureScale = 0.62 + clamp01(colony.currentExposure) * 0.38;
  const emphasisScale = colony.emphasized ? 1.08 : 1;
  const swayAmplitudeRadians = Math.min(
    config.maximumSwayRadians,
    spec.swayAmplitudeRadians * amplitudeVariation * exposureScale * emphasisScale,
  );
  const pulseVariation = 0.84 + seededUnit(colony.seed, 'reef-life-polyp-pulse') * 0.32;
  const pulseAmplitude = Math.min(
    config.maximumPolypPulseAmplitude,
    spec.polypPulseAmplitude * pulseVariation,
  );
  const phaseRadians = round6(seededUnit(colony.seed, 'reef-life-sway-phase') * TAU);

  return {
    id: `reef:life:motion-binding:colony:${colony.id}`,
    sourceRangeId,
    sourceMaterialBindingId,
    colonyId: colony.id,
    sequence: colony.sequence,
    morphotype: colony.morphotype,
    motionClass: spec.motionClass,
    pivot: { ...colony.position },
    axis: normalize(colony.normal),
    responseDirection: tangentDirection(current.direction, colony.normal, colony.facingRad),
    currentInfluence: round6(clamp01(spec.currentInfluence * (0.86 + current.strength * 0.14))),
    swayAmplitudeRadians: round6(swayAmplitudeRadians),
    swayFrequencyHz: round6(spec.swayFrequencyHz * frequencyVariation),
    phaseRadians,
    bendExponent: round6(spec.bendExponent),
    polyp: {
      coverage: round6(spec.polypCoverage),
      extension: round6(spec.polypExtension),
      pulseAmplitude: round6(pulseAmplitude),
      pulseFrequencyHz: round6(
        spec.polypPulseFrequencyHz
        * (0.88 + seededUnit(colony.seed, 'reef-life-polyp-frequency') * 0.24),
      ),
      phaseRadians: round6(seededUnit(colony.seed, 'reef-life-polyp-phase') * TAU),
    },
    reducedMotion: {
      mode: 'static',
      swayAmplitudeRadians: 0,
      polypPulseAmplitude: 0,
      timeScale: 0,
      staticPhaseRadians: phaseRadians,
    },
  };
}

function vectorIsUnit(value: ReefLayoutVec3): boolean {
  const magnitude = length(value);
  return Number.isFinite(magnitude) && Math.abs(magnitude - 1) <= 1e-4;
}

function bindingIsValid(binding: ReefColonyMotionBinding, config: ReefLifeConfig): boolean {
  const finiteValues = [
    binding.pivot.x,
    binding.pivot.y,
    binding.pivot.z,
    binding.currentInfluence,
    binding.swayAmplitudeRadians,
    binding.swayFrequencyHz,
    binding.phaseRadians,
    binding.bendExponent,
    binding.polyp.coverage,
    binding.polyp.extension,
    binding.polyp.pulseAmplitude,
    binding.polyp.pulseFrequencyHz,
    binding.polyp.phaseRadians,
    binding.reducedMotion.staticPhaseRadians,
  ];
  return finiteValues.every(Number.isFinite)
    && vectorIsUnit(binding.axis)
    && vectorIsUnit(binding.responseDirection)
    && binding.currentInfluence >= 0
    && binding.currentInfluence <= 1
    && binding.swayAmplitudeRadians >= 0
    && binding.swayAmplitudeRadians <= config.maximumSwayRadians
    && binding.swayFrequencyHz > 0
    && binding.phaseRadians >= 0
    && binding.phaseRadians <= TAU
    && binding.bendExponent >= 1
    && binding.polyp.coverage >= 0
    && binding.polyp.coverage <= 1
    && binding.polyp.extension >= 0
    && binding.polyp.extension <= 1
    && binding.polyp.pulseAmplitude >= 0
    && binding.polyp.pulseAmplitude <= config.maximumPolypPulseAmplitude
    && binding.polyp.pulseFrequencyHz > 0
    && binding.polyp.phaseRadians >= 0
    && binding.polyp.phaseRadians <= TAU
    && binding.reducedMotion.mode === 'static'
    && binding.reducedMotion.swayAmplitudeRadians === 0
    && binding.reducedMotion.polypPulseAmplitude === 0
    && binding.reducedMotion.timeScale === 0;
}

/**
 * Pure Phase 7 adapter. It publishes deterministic motion intent only; it does
 * not mutate geometry/materials, create renderer callbacks or read user state.
 */
export function buildReefLife(input: BuildReefLifeInput): ReefLifeState {
  const config = input.config ?? DEFAULT_REEF_LIFE_CONFIG;
  validateConfig(config);
  validateProvenance(input);

  const current = buildCurrent(input.species.artifactSeed, config);
  const coloniesById = new Map(input.layout.colonies.map((colony) => [colony.id, colony] as const));
  const ranges = input.meshes.batches
    .flatMap((batch) => batch.ranges)
    .sort((left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id));
  const materialBindings = input.materials.colonies.flatMap((material) => material.bindings);
  const materialBindingByRangeId = new Map(
    materialBindings.map((binding) => [binding.sourceRangeId, binding] as const),
  );
  const rangeIds = new Set(ranges.map((range) => range.id));
  const missingRangeIds: string[] = [];
  const missingMaterialBindingIds: string[] = [];
  const bindings: ReefColonyMotionBinding[] = [];

  for (const range of ranges) {
    const colony = coloniesById.get(range.colonyId);
    if (!colony || colony.morphotype !== range.morphotype) {
      missingRangeIds.push(range.id);
      continue;
    }
    const materialBinding = materialBindingByRangeId.get(range.id);
    if (!materialBinding || materialBinding.colonyId !== colony.id) {
      missingMaterialBindingIds.push(range.id);
      continue;
    }
    bindings.push(buildBinding(
      colony,
      range.id,
      materialBinding.id,
      current,
      config,
    ));
  }

  const boundRangeIds = new Set(bindings.map((binding) => binding.sourceRangeId));
  for (const range of ranges) {
    if (!boundRangeIds.has(range.id)
      && !missingRangeIds.includes(range.id)
      && !missingMaterialBindingIds.includes(range.id)) {
      missingRangeIds.push(range.id);
    }
  }
  const orphanMaterialBindingIds = materialBindings
    .filter((binding) => !rangeIds.has(binding.sourceRangeId))
    .map((binding) => binding.id)
    .sort();
  const invalidBindingIds = bindings
    .filter((binding) => !bindingIsValid(binding, config))
    .map((binding) => binding.id)
    .sort();

  return {
    reefLifeVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    descriptor: {
      id: 'reef:life',
      currentId: 'reef:life:current',
      colonyMotionBindingId: 'reef:life:motion-binding:colony',
    },
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceColonyLayoutVersion: input.layout.reefColonyLayoutVersion,
    sourceColonyLayoutRulesVersion: input.layout.rulesVersion,
    sourceFoundationMeshVersion: input.foundation.reefFoundationMeshVersion,
    sourceFoundationRulesVersion: input.foundation.rulesVersion,
    sourceColonySkeletonVersion: input.skeletons.reefColonySkeletonVersion,
    sourceColonySkeletonRulesVersion: input.skeletons.rulesVersion,
    sourceColonyMeshVersion: input.meshes.reefColonyMeshVersion,
    sourceColonyMeshRulesVersion: input.meshes.rulesVersion,
    sourceMaterialVersion: input.materials.reefMaterialVersion,
    sourceMaterialRulesVersion: input.materials.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    asOf: input.species.asOf,
    current,
    bindings,
    diagnostics: {
      sourceColonyRangeCount: ranges.length,
      sourceMaterialBindingCount: materialBindings.length,
      motionBindingCount: bindings.length,
      missingRangeIds: [...missingRangeIds].sort(),
      missingMaterialBindingIds: [...missingMaterialBindingIds].sort(),
      orphanMaterialBindingIds,
      invalidBindingIds,
      maximumMotionBindings: config.maximumMotionBindings,
      motionBindingBudgetExceeded: bindings.length > config.maximumMotionBindings,
      futureAnimatedBindingCount: bindings.length,
      reducedMotionStaticBindingCount: bindings.length,
      newDrawCalls: 0,
      geometryMutations: 0,
      materialIdentityMutations: 0,
      rendererCallbacks: 0,
      databaseReads: 0,
      databaseWrites: 0,
    },
  };
}
