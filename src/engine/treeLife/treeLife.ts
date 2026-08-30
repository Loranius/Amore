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

/*
 * ЧИСЛА ЗАКОНУ ХИТАННЯ ЛИСТКА — В ОДНОМУ МІСЦІ.
 *
 * Доти вони стояли літералами в `sampleTreeLifeFrame`, і це було нормально,
 * доки закон рахувався рівно один раз — на процесорі. Відколи те саме
 * хитання рахує ще й вершинний шейдер, будь-яке число тут існує у ДВОХ
 * реалізаціях, і розійтись вони можуть тихо: на екрані листок просто почне
 * хитатись інакше, і ніхто не скаже, коли саме це сталось.
 *
 * Тому GLSL збирається з ЦИХ констант (`treeLeafSway.ts`), а не з
 * переписаних від руки. Одне джерело, дві мови.
 */
export const TREE_LEAF_PITCH_PHASE_RATIO = 0.73;
export const TREE_LEAF_PITCH_PHASE_OFFSET = 0.48;

/**
 * Хитання одного листка в мить `elapsedSeconds`.
 *
 * Чиста функція профілю й часу — саме тому її можна віддати шейдеру: усе, що
 * вона читає, або незмінне (профіль), або однакове для всіх (час і масштаб).
 */
export function treeLeafSwayAt(
  profile: Pick<TreeLeafLifeProfile, 'speed' | 'phaseRad' | 'pitchAmplitudeRad' | 'rollAmplitudeRad'>,
  elapsedSeconds: number,
  scale: number,
): { pitchRad: number; rollRad: number } {
  const phase = elapsedSeconds * profile.speed + profile.phaseRad;
  return {
    pitchRad: Math.sin(phase * TREE_LEAF_PITCH_PHASE_RATIO + TREE_LEAF_PITCH_PHASE_OFFSET)
      * profile.pitchAmplitudeRad * scale,
    rollRad: Math.sin(phase) * profile.rollAmplitudeRad * scale,
  };
}

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
      /*
       * НУЛЬ, І ЦЕ НЕ ОПИСКА.
       *
       * Тут стояло `leaves.length`, і воно було правдою: рендер щокадру
       * розкладав кватерніон кожного листка, збирав матрицю назад і
       * відправляв увесь буфер матриць на відео. На живих даних це 651
       * листок за кадр — єдина покадрова витрата всієї сцени дерева.
       *
       * Відколи хитання листя рахує вершинний шейдер, за кадр змінюються
       * рівно два числа-однострої (час і масштаб), а матриці інстансів
       * лишаються статичними від першого кадру до останнього. Закон при
       * цьому НЕ ЗМІНИВСЯ — його переніс `treeLeafSwayAt`, спільний для
       * процесора й GLSL.
       */
      estimatedMatrixUpdatesPerFrame: 0,
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
      const sway = treeLeafSwayAt(leaf, elapsed, scale);
      return {
        leafInstanceId: leaf.leafInstanceId,
        sequence: leaf.sequence,
        pitchRad: motionRound(sway.pitchRad),
        rollRad: motionRound(sway.rollRad),
      };
    }),
  };
}
