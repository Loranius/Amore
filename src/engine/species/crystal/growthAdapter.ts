import type {
  GrowthHostPreference,
  UniversalGrowthBlueprint,
  UniversalGrowthInstruction,
} from '../../growth';
import type {
  CrystalGrowthInstruction,
  CrystalSpeciesBlueprint,
} from './types';

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function colonyMembership(blueprint: CrystalSpeciesBlueprint): Map<string, string> {
  const membership = new Map<string, string>();
  for (const colony of blueprint.colonies) {
    for (const instructionId of colony.instructionIds) membership.set(instructionId, colony.id);
  }
  return membership;
}

function hostPreference(instruction: CrystalGrowthInstruction): GrowthHostPreference {
  if (instruction.kind === 'mother' || instruction.kind === 'event-spire') return 'root';
  if (instruction.kind === 'inclusion') return 'same-colony';
  return 'balanced';
}

/**
 * Crystals read as one druse only while the hierarchy stays shallow.
 * Event spires are guaranteed root children through maxGeneration=1.
 */
function maxGeneration(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 1;
  if (instruction.kind === 'satellite') return 2;
  if (instruction.kind === 'inclusion') return 3;
  return 1;
}

/**
 * The analytical surface normal is mostly lateral. Crystal bodies must retain
 * more of their own seeded morphology than tree branches or coral polyps do,
 * otherwise a tall mother crystal turns into a trunk covered in horizontal
 * spikes.
 */
function directionInheritance(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 0.24;
  if (instruction.kind === 'satellite') return 0.36;
  if (instruction.kind === 'inclusion') return 0.48;
  return 0.5;
}

function minUpwardComponent(instruction: CrystalGrowthInstruction): number {
  if (instruction.kind === 'event-spire') return 0.62;
  if (instruction.kind === 'satellite') return 0.42;
  if (instruction.kind === 'inclusion') return 0.3;
  return 0.9;
}

/**
 * Full adult dimensions depend only on the stable instruction itself.
 * Global current pressures are intentionally excluded: a future event may add
 * a new body, but it must never resize historical skeletons.
 */
function dimensions(
  instruction: CrystalGrowthInstruction,
): { axialScale: number; radialScale: number } {
  if (instruction.kind === 'mother') {
    return { axialScale: 1.62, radialScale: 0.39 };
  }
  if (instruction.kind === 'event-spire') {
    return {
      axialScale: round6(0.76 + instruction.weight * 0.54),
      radialScale: round6(0.15 + instruction.weight * 0.065),
    };
  }
  if (instruction.kind === 'satellite') {
    return {
      axialScale: round6(0.42 + instruction.weight * 0.42),
      radialScale: round6(0.1 + instruction.weight * 0.045),
    };
  }
  return {
    axialScale: round6(0.18 + instruction.weight * 0.24),
    radialScale: round6(0.075 + instruction.weight * 0.03),
  };
}

function adaptInstruction(
  instruction: CrystalGrowthInstruction,
  sequence: number,
  colonyId: string | null,
): UniversalGrowthInstruction {
  const size = dimensions(instruction);
  return {
    id: instruction.id,
    sourceId: instruction.sourceEventId,
    sequence,
    colonyId,
    epochIndex: instruction.epochIndex,
    kind: `crystal:${instruction.kind}`,
    tier: instruction.tier,
    seed: instruction.seed,
    emphasized: instruction.emphasized,
    weight: instruction.weight,
    maturity: instruction.maturity,
    axialScale: size.axialScale,
    radialScale: size.radialScale,
    preferredAzimuthRad: instruction.azimuthRad,
    preferredElevation: instruction.elevation,
    radialBias: instruction.radialBias,
    attachmentDepth: instruction.attachmentDepth,
    hostPreference: hostPreference(instruction),
    maxGeneration: maxGeneration(instruction),
    directionInheritance: directionInheritance(instruction),
    minUpwardComponent: minUpwardComponent(instruction),
    attributes: {
      formationKind: instruction.kind,
      archetype: instruction.archetype,
      channel: instruction.channel,
      sourceEpisodeId: instruction.sourceEpisodeId,
    },
  };
}

/**
 * Crystal-only translation into the species-neutral Growth Engine contract.
 * No coordinates are chosen here.
 */
export function crystalToGrowthBlueprint(
  blueprint: CrystalSpeciesBlueprint,
): UniversalGrowthBlueprint {
  const membership = colonyMembership(blueprint);
  return {
    growthBlueprintVersion: 1,
    species: 'crystal',
    sourceBlueprintVersion: `crystal:${blueprint.speciesBlueprintVersion}`,
    engineVersion: blueprint.engineVersion,
    speciesRulesVersion: blueprint.rulesVersion,
    artifactSeed: blueprint.artifactSeed,
    root: adaptInstruction(blueprint.mother, -1, null),
    instructions: blueprint.formations.map((instruction, index) => adaptInstruction(
      instruction,
      index,
      membership.get(instruction.id) ?? null,
    )),
    colonies: blueprint.colonies.map((colony) => ({
      id: colony.id,
      seed: colony.seed,
      epochIndex: colony.epochIndex,
      kind: colony.channel,
      preferredAzimuthRad: colony.azimuthRad,
      preferredElevation: colony.elevation,
      weight: colony.weight,
      instructionIds: [...colony.instructionIds],
    })),
  };
}
