import {
  clamp01,
  round6,
  seededUnit,
} from '../growth/math';
import type {
  BuildTreeLifeInput,
  SampleTreeLifeInput,
  TreeBranchLifeProfile,
  TreeLeafLifeProfile,
  TreeLifeFrame,
  TreeLifeState,
} from './types';

function motionRound(value: number): number {
  const rounded = round6(value);
  return Object.is(rounded, -0) ? 0 : rounded;
}

function validateInput(input: BuildTreeLifeInput): void {
  const { species, composition, leaves, materials, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Life requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.maxLeafProfiles) || config.maxLeafProfiles < 0) {
    throw new Error('Tree Life maxLeafProfiles must be a non-negative integer.');
  }
  for (const lod of ['high', 'medium', 'low'] as const) {
    const scale = config.motionScaleByLod[lod];
    if (!Number.isFinite(scale) || scale < 0 || scale > 1) {
      throw new Error(`Tree Life motionScaleByLod.${lod} must be in the [0, 1] range.`);
    }
  }
  if (
    composition.artifactSeed !== species.artifactSeed
    || leaves.artifactSeed !== species.artifactSeed
    || materials.artifactSeed !== species.artifactSeed
  ) {
    throw new Error('Tree Life received states from different artifacts.');
  }
  if (composition.sourceSpeciesRulesVersion !== species.rulesVersion) {
    throw new Error('Tree Life species and composition rules do not match.');
  }
  if (materials.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion) {
    throw new Error('Tree Life species and material versions do not match.');
  }
  if (materials.sourceCompositionVersion !== composition.treeCompositionVersion) {
    throw new Error('Tree Life composition and material versions do not match.');
  }
  if (materials.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion) {
    throw new Error('Tree Life leaf geometry and material versions do not match.');
  }
}

function branchProfile(input: BuildTreeLifeInput): TreeBranchLifeProfile {
  const { species, composition } = input;
  const stability = clamp01(species.pressures.rootStability);
  const flexibility = 1 - stability * 0.38;
  const crownLoad = clamp01(
    species.pressures.crownSpread * 0.58
      + species.pressures.foliagePotential * 0.32
      + composition.score.crownDensity * 0.1,
  );
  return {
    phaseRad: round6(
      seededUnit(species.artifactSeed, 'tree-life:branch:phase') * Math.PI * 2,
    ),
    speed: round6(
      0.31 + seededUnit(species.artifactSeed, 'tree-life:branch:speed') * 0.17,
    ),
    swayXAmplitudeRad: round6((0.012 + crownLoad * 0.025) * flexibility),
    swayZAmplitudeRad: round6((0.009 + crownLoad * 0.019) * flexibility),
    twistAmplitudeRad: round6(
      (0.003 + species.pressures.asymmetry * 0.008) * flexibility,
    ),
  };
}

function leafProfile(
  input: BuildTreeLifeInput,
  leaf: BuildTreeLifeInput['leaves']['instances'][number],
): TreeLeafLifeProfile {
  const { species } = input;
  const salt = `tree-life:leaf:${leaf.id}`;
  const flexibility = 0.72 + seededUnit(species.artifactSeed, `${salt}:flex`) * 0.56;
  const foliageEnergy = clamp01(
    species.pressures.foliagePotential * 0.72
      + species.state.foliageMaturity * 0.28,
  );
  return {
    id: `tree:life:${leaf.id}`,
    leafInstanceId: leaf.id,
    sequence: leaf.sequence,
    phaseRad: round6(seededUnit(species.artifactSeed, `${salt}:phase`) * Math.PI * 2),
    speed: round6(1.1 + seededUnit(species.artifactSeed, `${salt}:speed`) * 1.65),
    pitchAmplitudeRad: round6((0.018 + foliageEnergy * 0.043) * flexibility),
    rollAmplitudeRad: round6((0.027 + foliageEnergy * 0.068) * flexibility),
  };
}

/**
 * Builds stable motion identities only. It never edits history, topology,
 * accepted geometry, leaf transforms or material recipes.
 */
export function buildTreeLifeState(input: BuildTreeLifeInput): TreeLifeState {
  validateInput(input);
  const acceptedLeaves = input.leaves.instances.slice(0, input.config.maxLeafProfiles);
  const truncatedLeafInstanceIds = input.leaves.instances
    .slice(input.config.maxLeafProfiles)
    .map((leaf) => leaf.id);
  const leaves = acceptedLeaves.map((leaf) => leafProfile(input, leaf));

  return {
    treeLifeStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceMaterialStateVersion: input.materials.treeMaterialStateVersion,
    artifactSeed: input.species.artifactSeed,
    lod: input.leaves.lod,
    reducedMotion: input.config.reducedMotion,
    motionScale: round6(input.config.motionScaleByLod[input.leaves.lod]),
    branch: branchProfile(input),
    leaves,
    diagnostics: {
      sourceLeafInstanceCount: input.leaves.instances.length,
      emittedLeafProfileCount: leaves.length,
      maxLeafProfiles: input.config.maxLeafProfiles,
      truncatedLeafInstanceIds,
      profileBudgetReached: truncatedLeafInstanceIds.length > 0,
      estimatedMatrixUpdatesPerFrame: leaves.length,
      estimatedAdditionalDrawCalls: 0,
    },
  };
}

export function sampleTreeLifeFrame(input: SampleTreeLifeInput): TreeLifeFrame {
  const elapsed = Number.isFinite(input.elapsedSeconds)
    ? Math.max(0, input.elapsedSeconds)
    : 0;
  const disabled = input.life.reducedMotion || input.reducedMotion === true;
  const scale = disabled ? 0 : input.life.motionScale;
  const branch = input.life.branch;
  const primaryWave = elapsed * branch.speed + branch.phaseRad;

  return {
    elapsedSeconds: round6(elapsed),
    branchRotationX: motionRound(Math.sin(primaryWave) * branch.swayXAmplitudeRad * scale),
    branchRotationY: motionRound(
      Math.sin(primaryWave * 0.63 + 0.91) * branch.twistAmplitudeRad * scale,
    ),
    branchRotationZ: motionRound(
      Math.sin(primaryWave * 0.81 + 1.37) * branch.swayZAmplitudeRad * scale,
    ),
    leaves: input.life.leaves.map((leaf) => {
      const phase = elapsed * leaf.speed + leaf.phaseRad;
      return {
        leafInstanceId: leaf.leafInstanceId,
        sequence: leaf.sequence,
        pitchRad: motionRound(
          Math.sin(phase * 0.73 + 0.48) * leaf.pitchAmplitudeRad * scale,
        ),
        rollRad: motionRound(Math.sin(phase) * leaf.rollAmplitudeRad * scale),
      };
    }),
  };
}
